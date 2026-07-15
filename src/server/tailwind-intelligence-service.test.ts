import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createTailwindLanguageServerRequestHandler,
  sanitizeTailwindCompletions,
  sanitizeTailwindDiagnostics,
  TailwindIntelligenceService,
} from "./tailwind-intelligence-service";
import { EditService } from "./edit-service";
import { registerTrustedTarget, type TrustedTargetConfig } from "./target-registration";

const prefixLength = 16;
const temporaryRoots: string[] = [];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function registeredTarget() {
  const root = await mkdtemp(join(tmpdir(), "design-space-intelligence-"));
  temporaryRoots.push(root);
  await writeFile(join(root, "target.tsx"), "export const target = {};\n", "utf8");
  await writeFile(join(root, "tailwind.css"), '@import "tailwindcss";\n', "utf8");
  const config = {
    project: { id: "demo", label: "Demo" },
    root,
    targetModule: "target.tsx",
    files: { "tailwind.intelligence": "tailwind.css" },
    editTargets: {},
    tailwindCompiler: {
      sourceFileIds: ["tailwind.intelligence"],
      intelligenceFileId: "tailwind.intelligence",
      compile: () => "",
    },
  } satisfies TrustedTargetConfig;
  return { root, target: await registerTrustedTarget(config) };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Tailwind LSP result confinement", () => {
  it("maps only in-field completion and diagnostic ranges", () => {
    const completions = sanitizeTailwindCompletions({
      items: [
        {
          label: "bg-red-500",
          detail: "background-color",
          textEdit: {
            range: {
              start: { line: 0, character: prefixLength },
              end: { line: 0, character: prefixLength + 4 },
            },
            newText: "bg-red-500",
          },
        },
        {
          label: "outside",
          textEdit: {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
            newText: "outside",
          },
        },
        { label: "command", command: { command: "run.unsafe" } },
        { label: "quote", insertText: 'before"after' },
      ],
    }, "bg-r", 4);
    expect(completions).toEqual([{
      label: "bg-red-500",
      detail: "background-color",
      insertText: "bg-red-500",
      replaceStart: 0,
      replaceEnd: 4,
      documentation: undefined,
    }]);

    expect(sanitizeTailwindCompletions([{
      label: "content-['hello']",
      insertText: "content-['hello']",
      textEdit: {
        range: {
          start: { line: 0, character: prefixLength },
          end: { line: 0, character: prefixLength + 11 },
        },
        newText: "content-['hello']",
      },
    }], "content-['h", 11)).toEqual([expect.objectContaining({
      insertText: "content-['hello']",
      replaceStart: 0,
      replaceEnd: 11,
    })]);

    const diagnostics = sanitizeTailwindDiagnostics({
      diagnostics: [
        {
          code: "cssConflict",
          severity: 2,
          message: "Conflicting utility",
          range: {
            start: { line: 0, character: prefixLength },
            end: { line: 0, character: prefixLength + 4 },
          },
        },
        {
          message: "Wrapper diagnostic",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } },
        },
      ],
    }, 4);
    expect(diagnostics).toEqual([{
      code: "cssConflict",
      message: "Conflicting utility",
      severity: "warning",
      start: 0,
      end: 4,
    }]);
  });

  it("caps completion output before it crosses the API boundary", () => {
    const items = Array.from({ length: 150 }, (_, index) => ({ label: `p-${index}` }));
    expect(sanitizeTailwindCompletions(items, "p", 1)).toHaveLength(100);
  });
});

describe("TailwindIntelligenceService", () => {
  it("uses the exact virtual wrapper, serializes requests, and isolates versionless diagnostics by URI", async () => {
    const { target } = await registeredTarget();
    const requests: Array<{ method: string; params: unknown; timeoutMs?: number }> = [];
    const notifications: Array<{ method: string; params: unknown }> = [];
    const handlers = new Map<string, (params: unknown) => void>();
    let activeCompletions = 0;
    let maximumActiveCompletions = 0;
    let disposed = false;
    const client = {
      async request<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T> {
        requests.push({ method, params, timeoutMs });
        if (method === "initialize") return { capabilities: {} } as T;
        activeCompletions += 1;
        maximumActiveCompletions = Math.max(maximumActiveCompletions, activeCompletions);
        const uri = (params as { textDocument: { uri: string } }).textDocument.uri;
        handlers.get("textDocument/publishDiagnostics")?.({
          uri: `${uri}-stale`,
          diagnostics: [{ message: "stale" }],
        });
        handlers.get("textDocument/publishDiagnostics")?.({
          uri,
          diagnostics: [{
            message: "Conflicting utility",
            severity: 2,
            range: {
              start: { line: 0, character: prefixLength },
              end: { line: 0, character: prefixLength + 1 },
            },
          }],
        });
        await new Promise((resolve) => setImmediate(resolve));
        activeCompletions -= 1;
        return [{
          label: "p-4",
          textEdit: {
            range: {
              start: { line: 0, character: prefixLength },
              end: { line: 0, character: prefixLength + 1 },
            },
            newText: "p-4",
          },
        }] as T;
      },
      notify(method: string, params?: unknown) {
        notifications.push({ method, params });
      },
      onNotification(method: string, handler: (params: unknown) => void) {
        handlers.set(method, handler);
        return () => handlers.delete(method);
      },
      dispose() {},
    };
    const service = new TailwindIntelligenceService(target, {
      createConnection: () => ({ client, dispose: () => { disposed = true; } }),
      requestTimeoutMs: 25,
      coldStartTimeoutMs: 50,
      idleTimeoutMs: 60_000,
    });

    const [first, second] = await Promise.all([service.analyze("p", 1), service.analyze("m", 1)]);
    handlers.get("@/tailwindCSS/projectInitialized")?.({});
    const third = await service.analyze("grid", 4);
    handlers.get("@/tailwindCSS/projectReset")?.({});
    const fourth = await service.analyze("flex", 4);
    expect(maximumActiveCompletions).toBe(1);
    expect(first).toMatchObject({
      value: "p",
      cursor: 1,
      engineVersion: "0.14.29",
      completions: [{ insertText: "p-4", replaceStart: 0, replaceEnd: 1 }],
      diagnostics: [{ message: "Conflicting utility", start: 0, end: 1 }],
    });
    expect(second.value).toBe("m");
    expect(third.value).toBe("grid");
    expect(fourth.value).toBe("flex");
    const opened = notifications.filter(({ method }) => method === "textDocument/didOpen");
    const changed = notifications.filter(({ method }) => method === "textDocument/didChange");
    const closed = notifications.filter(({ method }) => method === "textDocument/didClose");
    expect(opened).toHaveLength(4);
    expect(changed).toHaveLength(0);
    expect(closed).toHaveLength(3);
    expect(opened[0]?.params).toMatchObject({
      textDocument: { languageId: "javascriptreact", version: 1, text: '<div className="p"></div>' },
    });
    expect(opened[1]?.params).toMatchObject({
      textDocument: { languageId: "javascriptreact", version: 2, text: '<div className="m"></div>' },
    });
    const firstUri = (opened[0]?.params as { textDocument: { uri: string } }).textDocument.uri;
    const secondUri = (opened[1]?.params as { textDocument: { uri: string } }).textDocument.uri;
    expect(firstUri).not.toBe(secondUri);
    expect(closed[0]?.params).toMatchObject({ textDocument: { uri: firstUri } });
    expect(requests.filter(({ method }) => method === "initialize")).toHaveLength(1);
    expect(requests.map(({ method, timeoutMs }) => ({ method, timeoutMs }))).toEqual([
      { method: "initialize", timeoutMs: 50 },
      { method: "textDocument/completion", timeoutMs: 50 },
      { method: "textDocument/completion", timeoutMs: 50 },
      { method: "textDocument/completion", timeoutMs: 25 },
      { method: "textDocument/completion", timeoutMs: 50 },
    ]);
    service.dispose();
    await new Promise((resolve) => setImmediate(resolve));
    expect(disposed).toBe(true);
  });

  it("keeps only the latest queued analysis while one request is active", async () => {
    const { target } = await registeredTarget();
    const handlers = new Map<string, (params: unknown) => void>();
    const notifications: Array<{ method: string; params: unknown }> = [];
    const firstStarted = deferred();
    const releaseFirst = deferred();
    let completionCalls = 0;
    const client = {
      async request<T>(method: string, params?: unknown): Promise<T> {
        if (method === "initialize") return { capabilities: {} } as T;
        completionCalls += 1;
        if (completionCalls === 1) {
          firstStarted.resolve();
          await releaseFirst.promise;
        }
        const uri = (params as { textDocument: { uri: string } }).textDocument.uri;
        handlers.get("textDocument/publishDiagnostics")?.({
          uri,
          diagnostics: [{
            message: "Current diagnostic",
            range: {
              start: { line: 0, character: prefixLength },
              end: { line: 0, character: prefixLength + 1 },
            },
          }],
        });
        return [] as T;
      },
      notify(method: string, params?: unknown) {
        notifications.push({ method, params });
      },
      onNotification(method: string, handler: (params: unknown) => void) {
        handlers.set(method, handler);
        return () => handlers.delete(method);
      },
      dispose() {},
    };
    const service = new TailwindIntelligenceService(target, {
      createConnection: () => ({ client, dispose() {} }),
      diagnosticWaitMs: 5,
      idleTimeoutMs: 60_000,
    });

    const first = service.analyze("p", 1);
    await firstStarted.promise;
    const obsolete = service.analyze("m", 1);
    const obsoleteRejection = expect(obsolete).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("superseded"),
    });
    const latest = service.analyze("grid", 4);
    await obsoleteRejection;
    releaseFirst.resolve();

    await expect(first).resolves.toMatchObject({ value: "p" });
    await expect(latest).resolves.toMatchObject({ value: "grid" });
    expect(completionCalls).toBe(2);
    const documentTexts = notifications
      .filter(({ method }) => method === "textDocument/didOpen" || method === "textDocument/didChange")
      .map(({ params }) => methodDocumentText(params));
    expect(documentTexts).toEqual(['<div className="p"></div>', '<div className="grid"></div>']);
    service.dispose();
  });

  it("ignores diagnostics for an older document version and accepts versionless server results", async () => {
    const { target } = await registeredTarget();
    const handlers = new Map<string, (params: unknown) => void>();
    const notifications: Array<{ method: string; params: unknown }> = [];
    let completionCalls = 0;
    let firstUri: string | undefined;
    const diagnostic = (message: string) => ({
      message,
      range: {
        start: { line: 0, character: prefixLength },
        end: { line: 0, character: prefixLength + 1 },
      },
    });
    const client = {
      async request<T>(method: string, params?: unknown): Promise<T> {
        if (method === "initialize") return { capabilities: {} } as T;
        completionCalls += 1;
        const uri = (params as { textDocument: { uri: string } }).textDocument.uri;
        if (completionCalls === 1) {
          firstUri = uri;
          handlers.get("textDocument/publishDiagnostics")?.({
            uri,
            version: 1,
            diagnostics: [diagnostic("First version")],
          });
        } else {
          handlers.get("textDocument/publishDiagnostics")?.({
            uri: firstUri,
            diagnostics: [diagnostic("Stale versionless URI")],
          });
          handlers.get("textDocument/publishDiagnostics")?.({
            uri,
            version: 1,
            diagnostics: [diagnostic("Stale version")],
          });
          handlers.get("textDocument/publishDiagnostics")?.({
            uri,
            diagnostics: [diagnostic("Versionless current result")],
          });
        }
        return [] as T;
      },
      notify(method: string, params?: unknown) {
        notifications.push({ method, params });
      },
      onNotification(method: string, handler: (params: unknown) => void) {
        handlers.set(method, handler);
        return () => handlers.delete(method);
      },
      dispose() {},
    };
    const service = new TailwindIntelligenceService(target, {
      createConnection: () => ({ client, dispose() {} }),
      diagnosticWaitMs: 5,
      idleTimeoutMs: 60_000,
    });

    await expect(service.analyze("p", 1)).resolves.toMatchObject({
      diagnostics: [{ message: "First version" }],
    });
    await expect(service.analyze("m", 1)).resolves.toMatchObject({
      diagnostics: [{ message: "Versionless current result" }],
    });
    expect(notifications.filter(({ method }) => method === "textDocument/didOpen")).toHaveLength(2);
    expect(notifications.filter(({ method }) => method === "textDocument/didClose")).toHaveLength(1);
    service.dispose();
  });

  it("terminally rejects active, queued, and future analyses and closes the open document", async () => {
    const { target } = await registeredTarget();
    const handlers = new Map<string, (params: unknown) => void>();
    const notifications: Array<{ method: string; params: unknown }> = [];
    const completionStarted = deferred();
    const releaseCompletion = deferred();
    let starts = 0;
    let disposals = 0;
    const client = {
      async request<T>(method: string): Promise<T> {
        if (method === "initialize") return { capabilities: {} } as T;
        completionStarted.resolve();
        await releaseCompletion.promise;
        return [] as T;
      },
      notify(method: string, params?: unknown) {
        notifications.push({ method, params });
      },
      onNotification(method: string, handler: (params: unknown) => void) {
        handlers.set(method, handler);
        return () => handlers.delete(method);
      },
      dispose() {},
    };
    const service = new TailwindIntelligenceService(target, {
      createConnection: () => {
        starts += 1;
        return { client, dispose: () => { disposals += 1; } };
      },
      idleTimeoutMs: 60_000,
    });

    const active = service.analyze("p", 1);
    await completionStarted.promise;
    const queued = service.analyze("m", 1);
    const activeRejection = expect(active).rejects.toMatchObject({ message: expect.stringContaining("shut down") });
    const queuedRejection = expect(queued).rejects.toMatchObject({ message: expect.stringContaining("shut down") });
    service.dispose();

    await Promise.all([activeRejection, queuedRejection]);
    await expect(service.analyze("grid", 4)).rejects.toMatchObject({ message: expect.stringContaining("shut down") });
    await new Promise((resolve) => setImmediate(resolve));
    expect(disposals).toBe(1);
    expect(notifications.filter(({ method }) => method === "textDocument/didClose")).toHaveLength(1);
    expect(notifications.filter(({ method }) => method === "textDocument/didChange")).toHaveLength(0);
    releaseCompletion.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    service.dispose();
    expect(starts).toBe(1);
    expect(disposals).toBe(1);
  });

  it("rejects wrapper injection and invalid cursor ranges without starting the server", async () => {
    const { target } = await registeredTarget();
    let starts = 0;
    const service = new TailwindIntelligenceService(target, {
      createConnection: () => {
        starts += 1;
        throw new Error("must not start");
      },
    });
    await expect(service.analyze('p-4" onClick="unsafe', 3)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.analyze("p-4", 4)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(starts).toBe(0);
  });

  it("rejects browser-added executable and path fields before IntelliSense starts", async () => {
    const { target } = await registeredTarget();
    const service = new EditService(target);
    await expect(service.execute({
      type: "analyze-tailwind",
      value: "p-4",
      cursor: 3,
      path: "/etc/passwd",
      command: "run unsafe",
      module: "arbitrary-language-server",
    })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.execute({
      type: "analyze-tailwind",
      value: "p-4",
      cursor: 4,
    })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    service.dispose();
  });

  it("does not accept browser-selected paths, commands, or modules through configuration requests", async () => {
    const { root } = await registeredTarget();
    const intelligenceFile = join(root, "tailwind.css");
    const handler = createTailwindLanguageServerRequestHandler(root, intelligenceFile);
    const response = handler("workspace/configuration", {
      items: [{ section: "tailwindCSS", configPath: "/tmp/unsafe", command: "run", module: "other" }],
    });
    expect(response).toEqual([expect.objectContaining({
      experimental: { configFile: intelligenceFile },
    })]);
    expect(JSON.stringify(response)).not.toContain("/tmp/unsafe");
    expect(handler("workspace/applyEdit", { edit: { changes: { "/etc/passwd": [] } } }))
      .toEqual({ applied: false });
    expect(() => handler("browser/runCommand", { command: "unsafe" })).toThrow("Unsupported");
  });
});

function methodDocumentText(params: unknown): string | undefined {
  if (!params || typeof params !== "object") return undefined;
  if ("contentChanges" in params) {
    return (params as { contentChanges?: Array<{ text?: string }> }).contentChanges?.[0]?.text;
  }
  if ("textDocument" in params) {
    return (params as { textDocument?: { text?: string } }).textDocument?.text;
  }
  return undefined;
}
