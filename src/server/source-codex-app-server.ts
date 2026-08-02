import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface as ReadLineInterface } from "node:readline";

const defaultCodexBinary = "/Applications/ChatGPT.app/Contents/Resources/codex";
const maximumLineCharacters = 16 * 1024 * 1024;

type JsonRpcMessage = {
  error?: { code?: number; message?: string };
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
};

type PendingCall = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class SourceCodexAppServerError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message);
    this.name = "SourceCodexAppServerError";
  }
}

export interface SourceCodexRpcClient {
  call<Result>(method: string, params?: unknown): Promise<Result>;
  close(): Promise<void>;
}

export class SourceCodexAppServerClient implements SourceCodexRpcClient {
  private child?: ChildProcessWithoutNullStreams;
  private lineReader?: ReadLineInterface;
  private nextId = 1;
  private pending = new Map<number, PendingCall>();
  private ready?: Promise<void>;

  constructor(
    private readonly binaryPath = process.env.DESIGN_SPACE_CODEX_BINARY ?? defaultCodexBinary,
  ) {}

  async call<Result>(method: string, params?: unknown): Promise<Result> {
    await this.ensureReady();
    const child = this.child;
    if (!child || child.exitCode !== null) {
      throw new SourceCodexAppServerError("The local Codex app server is not available.");
    }
    const id = this.nextId++;
    return new Promise<Result>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new SourceCodexAppServerError("The local Codex request timed out.", 504));
      }, 15_000);
      this.pending.set(id, {
        reject,
        resolve: (value) => resolve(value as Result),
        timeout,
      });
      child.stdin.write(`${JSON.stringify(params === undefined ? { id, method } : { id, method, params })}\n`, (error) => {
        if (!error) return;
        const pending = this.takePending(id);
        pending?.reject(new SourceCodexAppServerError("The local Codex request could not be sent."));
      });
    });
  }

  async close(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    this.ready = undefined;
    this.lineReader?.close();
    this.lineReader = undefined;
    this.rejectPending("The local Codex app server closed.");
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }

  private ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.start();
    return this.ready;
  }

  private async start(): Promise<void> {
    const child = spawn(this.binaryPath, ["app-server", "--listen", "stdio://"], {
      env: process.env,
      stdio: "pipe",
      windowsHide: true,
    });
    this.child = child;
    child.stderr.on("data", () => {
      // Local diagnostics can contain private paths or prompt contents.
    });
    child.once("error", () => this.handleClose());
    child.once("close", () => this.handleClose());
    const lineReader = createInterface({ input: child.stdout });
    this.lineReader = lineReader;
    lineReader.on("line", (line) => this.handleLine(line));
    lineReader.once("close", () => this.handleClose());

    await this.callWithoutInitialization("initialize", {
      capabilities: { experimentalApi: true },
      clientInfo: {
        name: "design-space",
        title: "Design Space",
        version: "0.1.0",
      },
    });
    child.stdin.write(`${JSON.stringify({ method: "initialized", params: null })}\n`);
  }

  private callWithoutInitialization<Result>(method: string, params?: unknown): Promise<Result> {
    const child = this.child;
    if (!child) {
      return Promise.reject(new SourceCodexAppServerError("The local Codex app server did not start."));
    }
    const id = this.nextId++;
    return new Promise<Result>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new SourceCodexAppServerError("The local Codex app server did not initialize.", 504));
      }, 15_000);
      this.pending.set(id, {
        reject,
        resolve: (value) => resolve(value as Result),
        timeout,
      });
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`, (error) => {
        if (!error) return;
        const pending = this.takePending(id);
        pending?.reject(new SourceCodexAppServerError("The local Codex app server did not initialize."));
      });
    });
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    if (line.length > maximumLineCharacters) {
      void this.close();
      return;
    }
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }
    if (typeof message.id !== "number" || message.method) return;
    const pending = this.takePending(message.id);
    if (!pending) return;
    if (message.error) {
      pending.reject(new SourceCodexAppServerError(message.error.message ?? "Codex rejected the request.", 502));
    } else {
      pending.resolve(message.result);
    }
  }

  private handleClose(): void {
    this.child = undefined;
    this.ready = undefined;
    this.lineReader = undefined;
    this.rejectPending("The local Codex app server disconnected.");
  }

  private rejectPending(message: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new SourceCodexAppServerError(message));
    }
    this.pending.clear();
  }

  private takePending(id: number): PendingCall | undefined {
    const pending = this.pending.get(id);
    if (!pending) return undefined;
    clearTimeout(pending.timeout);
    this.pending.delete(id);
    return pending;
  }
}
