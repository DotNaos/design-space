import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { TailwindIntelligence } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import {
  JsonRpcMethodNotFoundError,
  JsonRpcStdioClient,
} from "./json-rpc-stdio-client";
import { assertStillRegistered } from "./path-security";
import { TailwindAnalysisQueue, tailwindDisposedError } from "./tailwind-analysis-queue";
import {
  sanitizeTailwindCompletions,
  sanitizeTailwindDiagnostics,
  tailwindWrapperPrefix,
  tailwindWrapperSuffix,
  unsafeTailwindClassFieldCharacters,
} from "./tailwind-intelligence-sanitizers";
import type { RegisteredTarget } from "./target-registration";

export {
  sanitizeTailwindCompletions,
  sanitizeTailwindDiagnostics,
} from "./tailwind-intelligence-sanitizers";

const require = createRequire(import.meta.url);
const languageServerPackagePath = require.resolve("@tailwindcss/language-server/package.json");
const languageServerBinaryPath = join(dirname(languageServerPackagePath), "bin", "tailwindcss-language-server");
const languageServerVersion = (() => {
  const parsed = JSON.parse(readFileSync(languageServerPackagePath, "utf8")) as { version?: unknown };
  return typeof parsed.version === "string" ? parsed.version : "unknown";
})();

const maximumClassFieldLength = 10_000;
const defaultRequestTimeoutMs = 10_000;
// The first request also starts the official server and indexes the trusted target.
const defaultColdStartTimeoutMs = 30_000;
// The official server intentionally debounces document diagnostics by 500 ms.
// Keep a small margin so one field analysis can return the matching result.
const defaultDiagnosticWaitMs = 650;
const defaultIdleTimeoutMs = 60_000;

interface LanguageClient {
  request<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  notify(method: string, params?: unknown): void;
  onNotification(method: string, handler: (params: unknown) => void): () => void;
  dispose(error?: Error): void;
}

interface LanguageServerConnection {
  client: LanguageClient;
  dispose: () => void;
}

interface ConnectionContext {
  root: string;
  intelligenceFile: string;
  requestTimeoutMs: number;
}

export interface TailwindIntelligenceServiceOptions {
  createConnection?: (context: ConnectionContext) => LanguageServerConnection | Promise<LanguageServerConnection>;
  requestTimeoutMs?: number;
  coldStartTimeoutMs?: number;
  diagnosticWaitMs?: number;
  idleTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fixedTailwindSettings(intelligenceFile: string): Readonly<Record<string, unknown>> {
  return Object.freeze({
    validate: true,
    suggestions: true,
    classAttributes: ["class", "className"],
    files: { exclude: ["**/.git/**", "**/.hg/**", "**/.svn/**", "**/node_modules/**"] },
    lint: {
      cssConflict: "warning",
      invalidApply: "error",
      invalidConfigPath: "error",
      invalidScreen: "error",
      invalidTailwindDirective: "error",
      invalidVariant: "error",
      recommendedVariantOrder: "warning",
    },
    experimental: { configFile: intelligenceFile },
  });
}

export function createTailwindLanguageServerRequestHandler(root: string, intelligenceFile: string) {
  const workspaceFolders = [{ uri: pathToFileURL(root).href, name: "Design Space target" }];
  const tailwindSettings = fixedTailwindSettings(intelligenceFile);
  return (method: string, params: unknown): unknown => {
    switch (method) {
      case "workspace/configuration": {
        const items = isRecord(params) && Array.isArray(params.items) ? params.items.slice(0, 64) : [];
        return items.map((item) => {
          const section = isRecord(item) ? item.section : undefined;
          if (section === "editor") return { tabSize: 2 };
          if (section === "tailwindCSS") return tailwindSettings;
          return null;
        });
      }
      case "workspace/workspaceFolders":
        return workspaceFolders;
      case "client/registerCapability":
      case "window/workDoneProgress/create":
      case "window/showMessageRequest":
        return null;
      case "workspace/applyEdit":
        return { applied: false };
      default:
        throw new JsonRpcMethodNotFoundError(method);
    }
  };
}

async function createOfficialConnection(context: ConnectionContext): Promise<LanguageServerConnection> {
  const child = spawn(process.execPath, [languageServerBinaryPath, "--stdio"], {
    cwd: context.root,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const client = new JsonRpcStdioClient({
    input: child.stdout,
    output: child.stdin,
    requestTimeoutMs: context.requestTimeoutMs,
    onRequest: createTailwindLanguageServerRequestHandler(context.root, context.intelligenceFile),
  });
  let disposed = false;
  let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    client.notify("exit");
    client.dispose();
    child.kill("SIGTERM");
    forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
    forceKillTimer.unref?.();
  };
  child.once("error", (error) => client.dispose(error));
  child.once("exit", () => {
    if (forceKillTimer) clearTimeout(forceKillTimer);
    client.dispose(new Error("The Tailwind language server exited"));
  });
  return { client, dispose };
}

function hasDiagnosticCandidates(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  return (Array.isArray(raw.diagnostics) && raw.diagnostics.length > 0) ||
    (Array.isArray(raw.items) && raw.items.length > 0);
}

function wait(milliseconds: number): Promise<undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), milliseconds);
    timer.unref?.();
  });
}

function diagnosticVersionMatches(params: Record<string, unknown>, expectedVersion: number): boolean {
  if (params.version === undefined) return true;
  return Number.isInteger(params.version) && params.version === expectedVersion;
}

/** Official Tailwind LSP facade confined to a target's server registration. */
export class TailwindIntelligenceService {
  readonly #target: RegisteredTarget;
  readonly #createConnection: NonNullable<TailwindIntelligenceServiceOptions["createConnection"]>;
  readonly #requestTimeoutMs: number;
  readonly #coldStartTimeoutMs: number;
  readonly #diagnosticWaitMs: number;
  readonly #idleTimeoutMs: number;
  readonly #analyses: TailwindAnalysisQueue;
  readonly #disposedConnections = new WeakSet<LanguageServerConnection>();
  #connectionPromise?: Promise<LanguageServerConnection>;
  #initializingConnection?: LanguageServerConnection;
  #documentVersion = 0;
  #openDocumentUri?: string;
  #idleTimer?: ReturnType<typeof setTimeout>;
  #connectionWarmed = false;
  #disposed = false;

  constructor(target: RegisteredTarget, options: TailwindIntelligenceServiceOptions = {}) {
    this.#target = target;
    this.#createConnection = options.createConnection ?? createOfficialConnection;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs;
    this.#coldStartTimeoutMs = options.coldStartTimeoutMs ?? defaultColdStartTimeoutMs;
    this.#diagnosticWaitMs = options.diagnosticWaitMs ?? defaultDiagnosticWaitMs;
    this.#idleTimeoutMs = options.idleTimeoutMs ?? defaultIdleTimeoutMs;
    this.#analyses = new TailwindAnalysisQueue((value, cursor) => this.#analyzeNow(value, cursor));
  }

  analyze(value: string, cursor: number): Promise<TailwindIntelligence> {
    return this.#analyses.analyze(value, cursor);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#idleTimer) clearTimeout(this.#idleTimer);
    this.#idleTimer = undefined;
    this.#analyses.dispose();
    this.#resetConnection();
  }

  #throwIfDisposed(): void {
    if (this.#disposed) throw tailwindDisposedError();
  }

  async #analyzeNow(value: string, cursor: number): Promise<TailwindIntelligence> {
    this.#throwIfDisposed();
    if (
      value.length > maximumClassFieldLength ||
      !Number.isInteger(cursor) ||
      cursor < 0 ||
      cursor > value.length ||
      unsafeTailwindClassFieldCharacters.test(value)
    ) {
      throw new DesignSpaceError("INVALID_REQUEST", "The Tailwind class field cannot be analyzed safely");
    }
    const fileId = this.#target.tailwindCompiler?.intelligenceFileId;
    const intelligenceFile = fileId ? this.#target.files.get(fileId) : undefined;
    if (!intelligenceFile) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "Tailwind IntelliSense is not registered for this target");
    }
    if (this.#idleTimer) clearTimeout(this.#idleTimer);
    this.#idleTimer = undefined;
    await assertStillRegistered(this.#target.root, intelligenceFile.path);
    this.#throwIfDisposed();
    try {
      const connection = await this.#ensureConnection(intelligenceFile.path);
      this.#throwIfDisposed();
      const version = ++this.#documentVersion;
      const uri = pathToFileURL(join(
        this.#target.root,
        "__design_space_virtual__",
        `tailwind-field-${version}.tsx`,
      )).href;
      const text = `${tailwindWrapperPrefix}${value}${tailwindWrapperSuffix}`;
      let diagnosticPayload: unknown;
      let resolveNonEmptyDiagnostics: ((value: unknown) => void) | undefined;
      const nonEmptyDiagnostics = new Promise<unknown>((resolve) => {
        resolveNonEmptyDiagnostics = resolve;
      });
      const stopDiagnostics = connection.client.onNotification("textDocument/publishDiagnostics", (params) => {
        if (
          !isRecord(params) ||
          params.uri !== uri ||
          this.#documentVersion !== version ||
          !diagnosticVersionMatches(params, version)
        ) return;
        diagnosticPayload = params;
        if (hasDiagnosticCandidates(params)) resolveNonEmptyDiagnostics?.(params);
      });
      if (this.#openDocumentUri) {
        connection.client.notify("textDocument/didClose", {
          textDocument: { uri: this.#openDocumentUri },
        });
      }
      connection.client.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: "javascriptreact", version, text },
      });
      this.#openDocumentUri = uri;
      try {
        const completion = await connection.client.request<unknown>("textDocument/completion", {
          textDocument: { uri },
          position: { line: 0, character: tailwindWrapperPrefix.length + cursor },
          context: { triggerKind: 1 },
        }, this.#connectionWarmed ? this.#requestTimeoutMs : this.#coldStartTimeoutMs);
        this.#connectionWarmed = true;
        this.#throwIfDisposed();
        if (!hasDiagnosticCandidates(diagnosticPayload)) {
          // The official server deliberately debounces document validation.
          // Wait only for a non-empty push result or the bounded debounce window.
          await Promise.race([nonEmptyDiagnostics, wait(this.#diagnosticWaitMs)]);
        }
        this.#throwIfDisposed();
        await assertStillRegistered(this.#target.root, intelligenceFile.path);
        this.#throwIfDisposed();
        this.#scheduleIdleDisposal();
        return {
          value,
          cursor,
          engineVersion: languageServerVersion,
          completions: sanitizeTailwindCompletions(completion, value, cursor),
          diagnostics: sanitizeTailwindDiagnostics(diagnosticPayload, value.length),
        };
      } finally {
        stopDiagnostics();
      }
    } catch (error) {
      this.#resetConnection();
      if (error instanceof DesignSpaceError) throw error;
      throw new DesignSpaceError("VALIDATION_ERROR", "Tailwind IntelliSense is temporarily unavailable");
    }
  }

  #ensureConnection(intelligenceFile: string): Promise<LanguageServerConnection> {
    this.#throwIfDisposed();
    if (!this.#connectionPromise) {
      this.#connectionPromise = Promise.resolve(this.#createConnection({
        root: this.#target.root,
        intelligenceFile,
        requestTimeoutMs: this.#requestTimeoutMs,
      })).then(async (connection) => {
        this.#initializingConnection = connection;
        try {
          this.#throwIfDisposed();
          const rootUri = pathToFileURL(this.#target.root).href;
          await connection.client.request("initialize", {
            processId: process.pid,
            clientInfo: { name: "Design Space", version: "0.1" },
            locale: "en",
            rootUri,
            workspaceFolders: [{ uri: rootUri, name: this.#target.project.label }],
            capabilities: {
              workspace: {
                configuration: true,
                workspaceFolders: true,
                didChangeWatchedFiles: { dynamicRegistration: false },
              },
              textDocument: {
                completion: {
                  dynamicRegistration: false,
                  contextSupport: true,
                  completionItem: {
                    snippetSupport: false,
                    documentationFormat: ["markdown", "plaintext"],
                    insertReplaceSupport: true,
                  },
                },
                publishDiagnostics: { relatedInformation: true },
              },
            },
            initializationOptions: {},
            trace: "off",
          }, this.#coldStartTimeoutMs);
          this.#throwIfDisposed();
          connection.client.notify("initialized", {});
          if (this.#initializingConnection === connection) this.#initializingConnection = undefined;
          return connection;
        } catch (error) {
          if (this.#initializingConnection === connection) this.#initializingConnection = undefined;
          this.#disposeConnection(connection);
          throw error;
        }
      });
    }
    return this.#connectionPromise;
  }

  #scheduleIdleDisposal(): void {
    if (this.#idleTimer) clearTimeout(this.#idleTimer);
    this.#idleTimer = setTimeout(() => this.#resetConnection(), this.#idleTimeoutMs);
    this.#idleTimer.unref?.();
  }

  #resetConnection(): void {
    if (this.#idleTimer) clearTimeout(this.#idleTimer);
    this.#idleTimer = undefined;
    const connection = this.#connectionPromise;
    const initializingConnection = this.#initializingConnection;
    const openDocumentUri = this.#openDocumentUri;
    this.#connectionPromise = undefined;
    this.#initializingConnection = undefined;
    this.#openDocumentUri = undefined;
    this.#connectionWarmed = false;
    if (initializingConnection) this.#disposeConnection(initializingConnection);
    if (connection) {
      void connection.then((resolvedConnection) => {
        const { client } = resolvedConnection;
        if (openDocumentUri) client.notify("textDocument/didClose", { textDocument: { uri: openDocumentUri } });
        this.#disposeConnection(resolvedConnection);
      }).catch(() => undefined);
    }
  }

  #disposeConnection(connection: LanguageServerConnection): void {
    if (this.#disposedConnections.has(connection)) return;
    this.#disposedConnections.add(connection);
    connection.dispose();
  }
}
