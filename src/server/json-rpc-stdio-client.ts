import type { Readable, Writable } from "node:stream";

// Tailwind's completion catalog can exceed 2 MiB before the server-side cap is applied.
const defaultMaximumMessageBytes = 16 * 1024 * 1024;
const maximumHeaderBytes = 8 * 1024;
const defaultRequestTimeoutMs = 10_000;
const maximumPendingRequests = 128;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

export interface JsonRpcStdioClientOptions {
  input: Readable;
  output: Writable;
  maximumMessageBytes?: number;
  requestTimeoutMs?: number;
  onRequest?: (method: string, params: unknown) => unknown | Promise<unknown>;
}

export class JsonRpcMethodNotFoundError extends Error {
  constructor(method: string) {
    super(`Unsupported language-server request: ${method}`);
    this.name = "JsonRpcMethodNotFoundError";
  }
}

export class JsonRpcRequestError extends Error {
  readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "JsonRpcRequestError";
    this.code = code;
  }
}

/** Minimal bounded JSON-RPC 2.0 transport for a trusted stdio language server. */
export class JsonRpcStdioClient {
  readonly #input: Readable;
  readonly #output: Writable;
  readonly #maximumMessageBytes: number;
  readonly #requestTimeoutMs: number;
  readonly #onRequest?: JsonRpcStdioClientOptions["onRequest"];
  readonly #pending = new Map<number, PendingRequest>();
  readonly #notificationHandlers = new Map<string, Set<(params: unknown) => void>>();
  #buffer = Buffer.alloc(0);
  #nextId = 1;
  #expectedBodyBytes: number | undefined;
  #closed = false;

  constructor(options: JsonRpcStdioClientOptions) {
    this.#input = options.input;
    this.#output = options.output;
    this.#maximumMessageBytes = options.maximumMessageBytes ?? defaultMaximumMessageBytes;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs;
    this.#onRequest = options.onRequest;
    this.#input.on("data", this.#handleData);
    this.#input.on("error", this.#handleTransportError);
    this.#input.on("end", this.#handleTransportEnd);
    this.#output.on("error", this.#handleTransportError);
  }

  request<T>(method: string, params?: unknown, timeoutMs = this.#requestTimeoutMs): Promise<T> {
    if (this.#closed) return Promise.reject(new Error("The language-server connection is closed"));
    if (this.#pending.size >= maximumPendingRequests) {
      return Promise.reject(new Error("The language-server request limit was reached"));
    }
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        this.notify("$/cancelRequest", { id });
        reject(new Error(`Language-server request timed out: ${method}`));
      }, timeoutMs);
      timer.unref?.();
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      try {
        this.#write({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error instanceof Error ? error : new Error("The language-server request could not be sent"));
      }
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.#closed) return;
    this.#write({ jsonrpc: "2.0", method, params });
  }

  onNotification(method: string, handler: (params: unknown) => void): () => void {
    const handlers = this.#notificationHandlers.get(method) ?? new Set();
    handlers.add(handler);
    this.#notificationHandlers.set(method, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.#notificationHandlers.delete(method);
    };
  }

  dispose(error = new Error("The language-server connection closed")): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#input.off("data", this.#handleData);
    this.#input.off("error", this.#handleTransportError);
    this.#input.off("end", this.#handleTransportEnd);
    this.#output.off("error", this.#handleTransportError);
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
    this.#notificationHandlers.clear();
  }

  #write(message: Readonly<Record<string, unknown>>): void {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    if (body.byteLength > this.#maximumMessageBytes) {
      throw new Error("The language-server message exceeds the size limit");
    }
    this.#output.write(`Content-Length: ${body.byteLength}\r\n\r\n`);
    this.#output.write(body);
  }

  readonly #handleData = (chunk: Buffer | string): void => {
    if (this.#closed) return;
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.#buffer = Buffer.concat([this.#buffer, bytes]);
    try {
      this.#drainBuffer();
    } catch (error) {
      this.dispose(error instanceof Error ? error : new Error("Invalid language-server message"));
    }
  };

  readonly #handleTransportError = (error: Error): void => {
    this.dispose(error);
  };

  readonly #handleTransportEnd = (): void => {
    this.dispose(new Error("The language server ended its output"));
  };

  #drainBuffer(): void {
    while (!this.#closed) {
      if (this.#expectedBodyBytes === undefined) {
        const headerEnd = this.#buffer.indexOf("\r\n\r\n");
        if (headerEnd < 0) {
          if (this.#buffer.byteLength > maximumHeaderBytes) throw new Error("Invalid language-server headers");
          return;
        }
        if (headerEnd > maximumHeaderBytes) throw new Error("Language-server headers exceed the size limit");
        const header = this.#buffer.subarray(0, headerEnd).toString("ascii");
        const lengthLine = header.split("\r\n").find((line) => /^content-length:/i.test(line));
        const lengthText = lengthLine?.slice(lengthLine.indexOf(":") + 1).trim() ?? "";
        if (!/^\d+$/.test(lengthText)) throw new Error("Language-server Content-Length is invalid");
        const length = Number(lengthText);
        if (!Number.isSafeInteger(length) || length > this.#maximumMessageBytes) {
          throw new Error("Language-server message exceeds the size limit");
        }
        this.#expectedBodyBytes = length;
        this.#buffer = this.#buffer.subarray(headerEnd + 4);
      }
      if (this.#buffer.byteLength < this.#expectedBodyBytes) return;
      const body = this.#buffer.subarray(0, this.#expectedBodyBytes);
      this.#buffer = this.#buffer.subarray(this.#expectedBodyBytes);
      this.#expectedBodyBytes = undefined;
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("Language-server message is not valid JSON");
      }
      this.#handleMessage(parsed);
    }
  }

  #handleMessage(value: unknown): void {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const message = value as JsonRpcMessage;
    if (message.jsonrpc !== "2.0") return;
    if (typeof message.method === "string") {
      if (message.id !== undefined) void this.#handleServerRequest(message);
      else for (const handler of this.#notificationHandlers.get(message.method) ?? []) handler(message.params);
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(message.id);
    if (message.error && typeof message.error === "object") {
      const rpcError = message.error as { code?: unknown; message?: unknown };
      pending.reject(new JsonRpcRequestError(
        typeof rpcError.message === "string" ? rpcError.message : "Language-server request failed",
        typeof rpcError.code === "number" ? rpcError.code : undefined,
      ));
    } else {
      pending.resolve(message.result);
    }
  }

  async #handleServerRequest(message: JsonRpcMessage): Promise<void> {
    const id = message.id;
    if (typeof id !== "number" && typeof id !== "string") return;
    try {
      if (!this.#onRequest || typeof message.method !== "string") {
        throw new JsonRpcMethodNotFoundError(String(message.method));
      }
      const result = await this.#onRequest(message.method, message.params);
      if (this.#closed) return;
      this.#write({ jsonrpc: "2.0", id, result: result ?? null });
    } catch (error) {
      if (this.#closed) return;
      const methodNotFound = error instanceof JsonRpcMethodNotFoundError;
      this.#write({
        jsonrpc: "2.0",
        id,
        error: {
          code: methodNotFound ? -32601 : -32603,
          message: methodNotFound ? "Method not found" : "Internal error",
        },
      });
    }
  }
}
