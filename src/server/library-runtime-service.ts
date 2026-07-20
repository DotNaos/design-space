import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { LibraryRuntimeOperation, LibraryRuntimeStatus } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import { isTrustedInstanceUrl } from "./running-target-registry";

const execFileAsync = promisify(execFile);
const maximumErrorLength = 600;

export interface RegisteredLibraryRuntime {
  packageName?: string;
  release?: { version: string };
  development?: {
    root: string;
    command: readonly [string, ...string[]];
    portlessName: string;
  };
}

export interface LibraryRuntimeServiceOptions {
  fetch?: typeof fetch;
  resolveUrl?: (registration: NonNullable<RegisteredLibraryRuntime["development"]>) => Promise<string | undefined>;
  spawn?: typeof spawn;
}

export class LibraryRuntimeService {
  readonly #registration: RegisteredLibraryRuntime;
  readonly #fetch: typeof fetch;
  readonly #resolveUrl: NonNullable<LibraryRuntimeServiceOptions["resolveUrl"]>;
  readonly #spawn: typeof spawn;
  #child?: ChildProcess;
  #state: LibraryRuntimeStatus["development"]["state"];
  #error?: string;
  #output = "";
  #components: NonNullable<LibraryRuntimeStatus["development"]["components"]> = [];

  constructor(registration: RegisteredLibraryRuntime = {}, options: LibraryRuntimeServiceOptions = {}) {
    this.#registration = registration;
    this.#fetch = options.fetch ?? fetch;
    this.#resolveUrl = options.resolveUrl ?? resolvePortlessUrl;
    this.#spawn = options.spawn ?? spawn;
    this.#state = registration.development ? "stopped" : "unconfigured";
  }

  async execute(operation: LibraryRuntimeOperation): Promise<LibraryRuntimeStatus> {
    if (operation.type === "get-library-runtime") return this.status();
    if (operation.type === "start-library-development") return this.start();
    return this.stop();
  }

  async status(): Promise<LibraryRuntimeStatus> {
    const development = this.#registration.development;
    if (!development) return this.snapshot();
    const url = await this.#resolveUrl(development).catch(() => undefined);
    if (url && await isReachable(url, this.#fetch)) {
      this.#state = "running";
      this.#error = undefined;
      if (this.#components.length === 0) this.#components = await readStorybookCatalog(url, this.#fetch, this.#registration.packageName);
      return this.snapshot(url);
    }
    if (this.#state === "running" && !this.#child) this.#state = "stopped";
    return this.snapshot();
  }

  async start(): Promise<LibraryRuntimeStatus> {
    const development = this.#registration.development;
    if (!development) throw new DesignSpaceError("INVALID_REGISTRATION", "No development library command is registered");
    const current = await this.status();
    if (current.development.state === "running" || this.#child) return current;

    this.#state = "starting";
    this.#error = undefined;
    this.#output = "";
    this.#components = [];
    const [command, ...args] = development.command;
    try {
      const child = this.#spawn(command, args, {
        cwd: development.root,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.#child = child;
      child.stdout?.on("data", (chunk) => this.captureOutput(chunk));
      child.stderr?.on("data", (chunk) => this.captureOutput(chunk));
      child.once("error", (error) => this.fail(error.message));
      child.once("exit", (code, signal) => {
        this.#child = undefined;
        if (this.#state === "stopped") return;
        this.fail(this.#output.trim() || `Development library exited (${signal ?? code ?? "unknown"})`);
      });
      return this.snapshot();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "The development library could not be started");
      return this.snapshot();
    }
  }

  async stop(): Promise<LibraryRuntimeStatus> {
    if (this.#child) {
      this.#state = "stopped";
      this.#child.kill("SIGTERM");
      this.#child = undefined;
    }
    this.#error = undefined;
    this.#components = [];
    return this.snapshot();
  }

  dispose(): void {
    if (!this.#child) return;
    this.#state = "stopped";
    this.#child.kill("SIGTERM");
    this.#child = undefined;
  }

  private captureOutput(chunk: unknown): void {
    this.#output = `${this.#output}${String(chunk)}`.slice(-maximumErrorLength);
  }

  private fail(message: string): void {
    this.#state = "failed";
    this.#error = message.slice(0, maximumErrorLength);
  }

  private snapshot(url?: string): LibraryRuntimeStatus {
    return {
      packageName: this.#registration.packageName,
      release: this.#registration.release,
      development: {
        configured: Boolean(this.#registration.development),
        managed: Boolean(this.#child),
        state: this.#state,
        ...(url ? { url } : {}),
        ...(this.#error ? { error: this.#error } : {}),
        ...(this.#components.length ? { components: this.#components } : {}),
      },
    };
  }
}

async function resolvePortlessUrl(registration: NonNullable<RegisteredLibraryRuntime["development"]>): Promise<string | undefined> {
  const result = await execFileAsync("portless", ["get", registration.portlessName], {
    cwd: registration.root,
    encoding: "utf8",
    timeout: 1_000,
  }).catch(() => undefined);
  const url = result?.stdout.trim();
  return url && isTrustedInstanceUrl(url) ? url : undefined;
}

async function isReachable(url: string, fetcher: typeof fetch): Promise<boolean> {
  if (!isTrustedInstanceUrl(url)) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);
  try {
    const response = await fetcher(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function readStorybookCatalog(
  url: string,
  fetcher: typeof fetch,
  packageName?: string,
): Promise<NonNullable<LibraryRuntimeStatus["development"]["components"]>> {
  const endpoint = new URL("/index.json", url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetcher(endpoint, { headers: { accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return [];
    const value = await response.json() as { entries?: unknown };
    if (!value.entries || typeof value.entries !== "object" || Array.isArray(value.entries)) return [];
    const components: Array<{ id: string; label: string; group: string }> = [];
    for (const [id, entry] of Object.entries(value.entries).slice(0, 2_000)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const story = entry as { type?: unknown; name?: unknown; title?: unknown };
      if (story.type !== "story" || typeof story.name !== "string" || typeof story.title !== "string") continue;
      if (packageName && !story.title.startsWith(`${packageName}/`)) continue;
      components.push({ id, label: story.name, group: packageName ? story.title.slice(packageName.length + 1) : story.title });
    }
    return Object.freeze(components.sort((left, right) => left.group.localeCompare(right.group, "en") || left.label.localeCompare(right.label, "en")));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
