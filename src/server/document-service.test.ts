import { chmod, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { canonicalJson } from "../shared/canonical-json";
import type { DesignDocument } from "../shared/design-document";
import type { StrictUiViolation } from "../shared/strict-ui";
import { DocumentService, type DocumentServiceOptions } from "./document-service";
import { registerTrustedTarget, type TrustedTargetConfig } from "./target-registration";

const initialDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.home",
  label: "Home",
  kind: "screen",
  root: { instanceId: "home.root", adapterId: "stack", slots: { content: [] } },
};

interface FixtureState {
  strictViolations: StrictUiViolation[];
  compileFails: boolean;
  compileCalls: number;
  materializeCalls: number;
  materializationMode: "current" | "malformed-document" | "stale-all" | "stale-document";
  mutatesDuringRoundTripLoad: boolean;
  returnsUnknownFile: boolean;
  mutatesDuringCompile: boolean;
}

describe("durable document service", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  async function fixture(serviceOptions: DocumentServiceOptions = {}, sourceDocument: DesignDocument = initialDocument) {
    const root = await mkdtemp(join(tmpdir(), "design-space-documents-"));
    roots.push(root);
    const documentPath = join(root, "home.design.json");
    const viewPath = join(root, "home.generated.tsx");
    const targetPath = join(root, "target.tsx");
    await writeFile(documentPath, `${canonicalJson(sourceDocument, 2)}\n`);
    await writeFile(viewPath, renderView(sourceDocument));
    await writeFile(targetPath, "export const target = {};\n");
    const state: FixtureState = {
      strictViolations: [],
      compileFails: false,
      compileCalls: 0,
      materializeCalls: 0,
      materializationMode: "current",
      mutatesDuringRoundTripLoad: false,
      returnsUnknownFile: false,
      mutatesDuringCompile: false,
    };
    const config: TrustedTargetConfig = {
      project: { id: "test-project", label: "Test project" },
      root,
      targetModule: "target.tsx",
      files: {
        "document.source": "home.design.json",
        "view.source": "home.generated.tsx",
      },
      editTargets: {},
      documentRegistration: {
        version: "test.strict.v1",
        tailwindClassList: () => "",
        documents: {
          [sourceDocument.id]: {
            sourceFileIds: ["document.source", "view.source"],
            writeFileIds: ["document.source", "view.source"],
            load: async (sources) => {
              if (
                state.mutatesDuringRoundTripLoad &&
                sources["document.source"] !== `${canonicalJson(initialDocument, 2)}\n`
              ) {
                await writeFile(viewPath, "// concurrent round-trip loader mutation\n");
              }
              return JSON.parse(sources["document.source"]);
            },
            strictUi: () => state.strictViolations,
            materialize: (document) => {
              state.materializeCalls += 1;
              const serializedDocument = state.materializationMode === "current" ? document : sourceDocument;
              const renderedDocument = state.materializationMode === "stale-all" ? sourceDocument : document;
              const output: Record<string, string> = {
                "document.source": state.materializationMode === "malformed-document"
                  ? "{ malformed document source\n"
                  : `${canonicalJson(serializedDocument, 2)}\n`,
                "view.source": renderView(renderedDocument),
              };
              if (state.returnsUnknownFile) output["arbitrary.output"] = "unsafe";
              return output;
            },
            compile: async () => {
              state.compileCalls += 1;
              if (state.mutatesDuringCompile) await writeFile(viewPath, "// concurrent compile mutation\n");
              if (state.compileFails) throw new Error("private compiler detail");
            },
          },
        },
      },
    };
    const registered = await registerTrustedTarget(config);
    return {
      root,
      documentPath,
      viewPath,
      state,
      registered,
      service: new DocumentService(registered, serviceOptions),
    };
  }

  it("reads only registered documents and rejects browser-selected inputs", async () => {
    const { service } = await fixture();
    const snapshot = await service.execute({ type: "read-document", documentId: "screen.home" });
    expect(snapshot).toMatchObject({ documentId: "screen.home", document: initialDocument });
    for (const attempt of [
      { type: "read-document", documentId: "screen.home", path: "/etc/passwd" },
      { type: "read-document", documentId: "missing.document" },
      { type: "run-command", command: "echo unsafe" },
    ]) {
      await expect(service.execute(attempt)).rejects.toMatchObject({
        code: attempt.type === "read-document" && attempt.documentId === "missing.document" ? "NOT_FOUND" : "INVALID_REQUEST",
      });
    }
    if (!("document" in snapshot)) throw new Error("Expected a document snapshot");
    await expect(service.prepare(
      "screen.home",
      { ...snapshot.document, id: "screen.other" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.prepare(
      "screen.home",
      snapshot.document,
      snapshot.documentDigest,
      { ...snapshot.sourceVersions, "arbitrary.output": "a".repeat(64) },
    )).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("prepares a deterministic exact diff without writing, then persists and reloads", async () => {
    const { documentPath, viewPath, service } = await fixture();
    const snapshot = await service.read("screen.home");
    const next = { ...snapshot.document, label: "Updated home" };
    const beforeDocument = await readFile(documentPath, "utf8");
    const beforeView = await readFile(viewPath, "utf8");
    const first = await service.prepare("screen.home", next, snapshot.documentDigest, snapshot.sourceVersions);
    const second = await service.prepare("screen.home", next, snapshot.documentDigest, snapshot.sourceVersions);
    expect(first.state).toBe("ready");
    expect(second.state).toBe("ready");
    if (first.state !== "ready" || second.state !== "ready") throw new Error("Expected ready saves");
    expect(first.diff).toBe(second.diff);
    expect(first.transactionDigest).toBe(second.transactionDigest);
    expect(first.strictUi.basis).toMatchObject({
      documentDigest: first.documentDigest,
      ruleSetVersion: "test.strict.v1",
    });
    expect(first.changes.map((change) => change.fileId)).toEqual(["document.source", "view.source"]);
    expect(first.diff).toContain("--- a/home.design.json");
    expect(first.diff).toContain('-  "label": "Home",');
    expect(first.diff).toContain('+  "label": "Updated home",');
    expect(first.diff).toContain("--- a/home.generated.tsx");
    expect(await readFile(documentPath, "utf8")).toBe(beforeDocument);
    expect(await readFile(viewPath, "utf8")).toBe(beforeView);

    await expect(service.save(first.challengeId)).resolves.toMatchObject({ state: "saved", documentId: "screen.home" });
    await expect(service.save(second.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    await expect(service.read("screen.home")).resolves.toMatchObject({ document: { label: "Updated home" } });
  });

  it.each([
    ["screen to component", initialDocument, "component"],
    ["component to screen", componentDocument, "screen"],
  ] as const)("rejects changing an existing document from %s before validation or a save challenge", async (
    _,
    sourceDocument,
    nextKind,
  ) => {
    let issuedIds = 0;
    const { documentPath, viewPath, service, state } = await fixture({
      createId: () => {
        issuedIds += 1;
        return "33333333-3333-4333-8333-333333333333";
      },
    }, sourceDocument);
    const snapshot = await service.read(sourceDocument.id);
    const proposed: DesignDocument = nextKind === "component"
      ? {
          ...snapshot.document,
          kind: "component",
          component: {
            id: "authored.switched",
            label: "Switched",
            group: "Custom",
            properties: [],
            slots: [],
          },
        }
      : screenFrom(snapshot.document);
    const beforeDocument = await readFile(documentPath, "utf8");
    const beforeView = await readFile(viewPath, "utf8");

    await expect(service.prepare(
      sourceDocument.id,
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      message: "The document kind cannot be changed after creation",
    });

    expect(issuedIds).toBe(0);
    expect(state.materializeCalls).toBe(0);
    expect(state.compileCalls).toBe(0);
    expect(await readFile(documentPath, "utf8")).toBe(beforeDocument);
    expect(await readFile(viewPath, "utf8")).toBe(beforeView);
  });

  it("blocks Strict UI errors without materializing or issuing a save challenge", async () => {
    const { service, state } = await fixture();
    state.strictViolations = [{
      ruleId: "slot.required",
      severity: "error",
      message: "Content is required",
      location: { kind: "slot", instanceId: "home.root", slotId: "content" },
    }];
    const snapshot = await service.read("screen.home");
    const prepared = await service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Blocked" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    expect(prepared).toMatchObject({ state: "strict-blocked", strictUi: { status: "blocked" } });
    expect("challengeId" in prepared).toBe(false);
    expect(state.materializeCalls).toBe(0);
    expect(state.compileCalls).toBe(0);
  });

  it("rejects output file IDs chosen outside the trusted document registration", async () => {
    const { service, state } = await fixture();
    state.returnsUnknownFile = true;
    const snapshot = await service.read("screen.home");
    await expect(service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Unsafe materialization" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
  });

  it.each([
    ["entirely stale", "stale-all"],
    ["partially stale", "stale-document"],
  ] as const)("rejects %s materialized sources that do not reload to the proposed document", async (_, mode) => {
    const { documentPath, viewPath, service, state } = await fixture();
    state.materializationMode = mode;
    const snapshot = await service.read("screen.home");
    const beforeDocument = await readFile(documentPath, "utf8");
    const beforeView = await readFile(viewPath, "utf8");

    await expect(service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Draft that must survive materialization" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).rejects.toMatchObject({
      code: "INVALID_REGISTRATION",
      message: "The target materialization did not preserve the document",
    });
    expect(state.compileCalls).toBe(0);
    expect(await readFile(documentPath, "utf8")).toBe(beforeDocument);
    expect(await readFile(viewPath, "utf8")).toBe(beforeView);
  });

  it("rejects malformed materialized document sources before compiling or issuing a challenge", async () => {
    const { service, state } = await fixture();
    state.materializationMode = "malformed-document";
    const snapshot = await service.read("screen.home");

    await expect(service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Malformed round trip" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).rejects.toMatchObject({ code: "INVALID_DOCUMENT" });
    expect(state.compileCalls).toBe(0);
  });

  it.each(["current", "malformed-document"] as const)(
    "preserves stale-source errors during a %s round-trip loader callback",
    async (mode) => {
      const { service, state } = await fixture();
      state.materializationMode = mode;
      state.mutatesDuringRoundTripLoad = true;
      const snapshot = await service.read("screen.home");

      await expect(service.prepare(
        "screen.home",
        { ...snapshot.document, label: "Concurrent round trip" },
        snapshot.documentDigest,
        snapshot.sourceVersions,
      )).rejects.toMatchObject({ code: "STALE_SOURCE" });
      expect(state.compileCalls).toBe(0);
    },
  );

  it("allows warnings but returns compile failures without a challenge and then recovers", async () => {
    const { documentPath, service, state } = await fixture();
    state.strictViolations = [{
      ruleId: "content.recommended",
      severity: "warning",
      message: "Add supporting copy",
      location: { kind: "document" },
    }];
    state.compileFails = true;
    const snapshot = await service.read("screen.home");
    const next = { ...snapshot.document, label: "Recovery" };
    const blocked = await service.prepare("screen.home", next, snapshot.documentDigest, snapshot.sourceVersions);
    expect(blocked).toMatchObject({
      state: "compile-blocked",
      strictUi: { status: "warnings" },
      compile: { status: "failed", message: "The target did not compile" },
    });
    expect("challengeId" in blocked).toBe(false);
    expect(await readFile(documentPath, "utf8")).toContain('"label": "Home"');

    state.compileFails = false;
    const recovered = await service.prepare("screen.home", next, snapshot.documentDigest, snapshot.sourceVersions);
    expect(recovered).toMatchObject({ state: "ready", strictUi: { status: "warnings" } });
    if (recovered.state !== "ready") throw new Error("Expected recovery save");
    await expect(service.save(recovered.challengeId)).resolves.toMatchObject({ state: "saved" });
  });

  it("rejects stale prepares and dependency changes before save", async () => {
    const { documentPath, viewPath, service } = await fixture();
    const initial = await service.read("screen.home");
    await writeFile(viewPath, "// external dependency edit\n");
    await expect(service.prepare(
      "screen.home",
      { ...initial.document, label: "Stale" },
      initial.documentDigest,
      initial.sourceVersions,
    )).rejects.toMatchObject({ code: "STALE_SOURCE" });

    await writeFile(viewPath, renderView(initialDocument));
    const current = await service.read("screen.home");
    const prepared = await service.prepare(
      "screen.home",
      { ...current.document, label: "Concurrent" },
      current.documentDigest,
      current.sourceVersions,
    );
    if (prepared.state !== "ready") throw new Error("Expected ready save");
    await writeFile(viewPath, "// changed before save\n");
    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(await readFile(documentPath, "utf8")).toContain('"label": "Home"');
  });

  it("rehashes after target hooks and rejects a concurrent compiler-side source change", async () => {
    const { service, state } = await fixture();
    state.mutatesDuringCompile = true;
    const snapshot = await service.read("screen.home");
    await expect(service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Concurrent hook" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).rejects.toMatchObject({ code: "STALE_SOURCE" });
  });

  it("rejects an in-place source change during final transaction staging", async () => {
    let documentPath = "";
    const base = await fixture({
      transactionHooks: {
        beforeInstall: async () => {
          await writeFile(documentPath, `${canonicalJson({ ...initialDocument, label: "Concurrent external edit" }, 2)}\n`);
        },
      },
    });
    documentPath = base.documentPath;
    const snapshot = await base.service.read("screen.home");
    const prepared = await base.service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Design Space edit" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    if (prepared.state !== "ready") throw new Error("Expected ready save");

    await expect(base.service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(await readFile(base.documentPath, "utf8")).toContain('"label": "Concurrent external edit"');
    expect((await readdir(base.root)).filter((name) => name.includes(".design-space-"))).toEqual([]);
  });

  it("rechecks root confinement when a registered document is replaced by a symlink", async () => {
    const { documentPath, service } = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "design-space-document-swap-"));
    roots.push(outside);
    const outsideDocument = join(outside, "outside.json");
    await writeFile(outsideDocument, `${canonicalJson(initialDocument, 2)}\n`);
    await rm(documentPath);
    await symlink(outsideDocument, documentPath);
    await expect(service.read("screen.home")).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("rolls every file back to its exact bytes and modes when a multi-file install fails", async () => {
    const base = await fixture({
      transactionHooks: {
        afterInstall: (_fileId, count) => {
          if (count === 1) throw new Error("injected failure");
        },
      },
    });
    await chmod(base.documentPath, 0o640);
    await chmod(base.viewPath, 0o600);
    const beforeDocument = await readFile(base.documentPath);
    const beforeView = await readFile(base.viewPath);
    const snapshot = await base.service.read("screen.home");
    const prepared = await base.service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Must roll back" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    if (prepared.state !== "ready") throw new Error("Expected ready save");
    await expect(base.service.save(prepared.challengeId)).rejects.toMatchObject({ code: "TRANSACTION_FAILED" });
    expect(await readFile(base.documentPath)).toEqual(beforeDocument);
    expect(await readFile(base.viewPath)).toEqual(beforeView);
    expect((await stat(base.documentPath)).mode & 0o777).toBe(0o640);
    expect((await stat(base.viewPath)).mode & 0o777).toBe(0o600);
    expect((await readdir(base.root)).filter((name) => name.includes(".design-space-"))).toEqual([]);
  });

  it("expires one-time challenges and serializes competing saves", async () => {
    let now = 1_000;
    const expiring = await fixture({ now: () => now, challengeTtlMs: 50 });
    const snapshot = await expiring.service.read("screen.home");
    const expired = await expiring.service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Expired" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    if (expired.state !== "ready") throw new Error("Expected ready save");
    now = 1_051;
    await expect(expiring.service.save(expired.challengeId)).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
    await expect(expiring.service.save(expired.challengeId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const competing = await fixture();
    const current = await competing.service.read("screen.home");
    const first = await competing.service.prepare(
      "screen.home",
      { ...current.document, label: "First" },
      current.documentDigest,
      current.sourceVersions,
    );
    const second = await competing.service.prepare(
      "screen.home",
      { ...current.document, label: "Second" },
      current.documentDigest,
      current.sourceVersions,
    );
    if (first.state !== "ready" || second.state !== "ready") throw new Error("Expected competing saves");
    const results = await Promise.allSettled([
      competing.service.save(first.challengeId),
      competing.service.save(second.challengeId),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});

function renderView(document: DesignDocument): string {
  return `export const documentLabel = ${JSON.stringify(document.label)};\n`;
}

const componentDocument: DesignDocument = {
  schemaVersion: 2,
  id: "component.notice",
  label: "Notice",
  kind: "component",
  component: {
    id: "authored.notice",
    label: "Notice",
    group: "Custom",
    properties: [],
    slots: [],
  },
  root: { instanceId: "notice.root", adapterId: "stack", slots: { content: [] } },
};

function screenFrom(document: DesignDocument): DesignDocument {
  const { component: _component, ...screen } = document;
  return { ...screen, kind: "screen" };
}
