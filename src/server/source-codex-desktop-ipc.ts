import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const initializingClientId = "initializing-client";
const maximumFrameBytes = 8 * 1024 * 1024;
const requestTimeoutMs = 10_000;

type IpcRecord = Record<string, unknown>;

export type SourceCodexDesktopMessageInput = {
  cwd: string;
  localImagePaths?: readonly string[];
  operationId: string;
  prompt: string;
  threadId: string;
};

export interface SourceCodexDesktopMessageClient {
  startTurn(input: SourceCodexDesktopMessageInput): Promise<void>;
  steerTurn(input: SourceCodexDesktopMessageInput): Promise<void>;
}

export class SourceCodexDesktopIpcError extends Error {
  readonly code = "source_codex_desktop_ipc_error";
}

export class SourceCodexDesktopIpcClient implements SourceCodexDesktopMessageClient {
  private readonly socketPath: string;

  constructor(options: { codexHome?: string; socketPath?: string } = {}) {
    this.socketPath = options.socketPath
      ?? join(options.codexHome ?? join(homedir(), ".codex"), "ipc", "ipc.sock");
  }

  async startTurn(input: SourceCodexDesktopMessageInput): Promise<void> {
    await this.requestOwner("thread-follower-start-turn", {
      conversationId: input.threadId,
      turnStartParams: {
        attachments: [],
        clientUserMessageId: input.operationId,
        cwd: input.cwd,
        input: desktopTurnInput(input.prompt, input.localImagePaths),
        useAppServerPermissionDefault: true,
      },
    });
  }

  async steerTurn(input: SourceCodexDesktopMessageInput): Promise<void> {
    await this.requestOwner("thread-follower-steer-turn", {
      attachments: [],
      clientUserMessageId: input.operationId,
      conversationId: input.threadId,
      input: desktopTurnInput(input.prompt, input.localImagePaths),
      restoreMessage: {
        context: {
          prompt: input.prompt,
          workspaceRoots: [input.cwd],
        },
        createdAt: Date.now(),
        cwd: input.cwd,
        id: input.operationId,
        text: input.prompt,
      },
      serviceTier: null,
    });
  }

  private async requestOwner(method: string, params: IpcRecord): Promise<void> {
    await validateSocket(this.socketPath);
    const connection = await DesktopIpcConnection.open(this.socketPath);
    try {
      await connection.initialize();
      await connection.request(method, params, 1);
    } finally {
      connection.close();
    }
  }
}

function desktopTurnInput(prompt: string, localImagePaths: readonly string[] = []) {
  return [{
    text: prompt,
    text_elements: [],
    type: "text",
  }, ...localImagePaths.map((path) => ({ path, type: "localImage" as const }))];
}

class DesktopIpcConnection {
  private buffer = Buffer.alloc(0);
  private clientId = initializingClientId;
  private readonly pending = new Map<
    string,
    {
      reject(error: Error): void;
      resolve(value: IpcRecord): void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  private constructor(private readonly socket: Socket) {
    socket.on("data", (chunk) => this.receive(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ));
    socket.on("error", (error) => this.failAll(asIpcError(error)));
    socket.on("close", () => this.failAll(new SourceCodexDesktopIpcError(
      "The Codex Desktop connection closed before the request was confirmed.",
    )));
  }

  static async open(socketPath: string): Promise<DesktopIpcConnection> {
    const socket = createConnection(socketPath);
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        socket.off("error", onError);
        resolve();
      };
      const onError = (error: Error) => {
        socket.off("connect", onConnect);
        reject(asIpcError(error));
      };
      socket.once("connect", onConnect);
      socket.once("error", onError);
    });
    return new DesktopIpcConnection(socket);
  }

  async initialize(): Promise<void> {
    const response = await this.sendRequest("initialize", {
      clientType: "design-space-canvas-feedback",
    }, 0);
    const result = record(response.result);
    const clientId = result?.clientId;
    if (
      response.resultType !== "success"
      || response.method !== "initialize"
      || typeof clientId !== "string"
      || clientId.length === 0
    ) {
      throw new SourceCodexDesktopIpcError(
        "Codex Desktop did not initialize the local connection.",
      );
    }
    this.clientId = clientId;
  }

  async request(method: string, params: IpcRecord, version: number): Promise<IpcRecord> {
    const response = await this.sendRequest(method, params, version);
    if (response.resultType !== "success" || response.method !== method) {
      throw new SourceCodexDesktopIpcError(
        response.error === "no-client-found"
          ? "The owning Codex task is not available in the Desktop app."
          : "Codex Desktop did not confirm the request.",
      );
    }
    return response;
  }

  close(): void {
    this.socket.destroy();
  }

  private sendRequest(
    method: string,
    params: IpcRecord,
    version: number,
  ): Promise<IpcRecord> {
    const requestId = randomUUID();
    return new Promise<IpcRecord>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new SourceCodexDesktopIpcError("Codex Desktop did not answer in time."));
      }, requestTimeoutMs);
      this.pending.set(requestId, { reject, resolve, timeout });
      this.write({
        method,
        params,
        requestId,
        sourceClientId: this.clientId,
        timeoutMs: requestTimeoutMs,
        type: "request",
        version,
      });
    });
  }

  private receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length === 0 || length > maximumFrameBytes) {
        this.failAll(new SourceCodexDesktopIpcError("Codex Desktop sent an invalid message."));
        this.socket.destroy();
        return;
      }
      if (this.buffer.length < length + 4) return;
      const frame = this.buffer.subarray(4, length + 4);
      this.buffer = this.buffer.subarray(length + 4);
      let message: unknown;
      try {
        message = JSON.parse(frame.toString("utf8"));
      } catch {
        this.failAll(new SourceCodexDesktopIpcError("Codex Desktop sent invalid JSON."));
        this.socket.destroy();
        return;
      }
      this.handleMessage(record(message));
    }
  }

  private handleMessage(message: IpcRecord | undefined): void {
    if (!message) return;
    if (message.type === "client-discovery-request" && typeof message.requestId === "string") {
      this.write({
        requestId: message.requestId,
        response: { canHandle: false },
        type: "client-discovery-response",
      });
      return;
    }
    if (message.type !== "response" || typeof message.requestId !== "string") return;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(message.requestId);
    pending.resolve(message);
  }

  private write(message: IpcRecord): void {
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    if (payload.length > maximumFrameBytes) {
      throw new SourceCodexDesktopIpcError("The Codex Desktop request is too large.");
    }
    const frame = Buffer.allocUnsafe(payload.length + 4);
    frame.writeUInt32LE(payload.length, 0);
    payload.copy(frame, 4);
    this.socket.write(frame);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function validateSocket(socketPath: string): Promise<void> {
  const [socket, directory] = await Promise.all([
    lstat(socketPath),
    lstat(dirname(socketPath)),
  ]).catch((error) => {
    throw asIpcError(error);
  });
  const uid = process.getuid?.();
  if (
    !socket.isSocket()
    || !directory.isDirectory()
    || uid === undefined
    || socket.uid !== uid
    || directory.uid !== uid
    || (directory.mode & 0o022) !== 0
  ) {
    throw new SourceCodexDesktopIpcError("The Codex Desktop socket is not trusted.");
  }
}

function record(value: unknown): IpcRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as IpcRecord
    : undefined;
}

function asIpcError(error: unknown): SourceCodexDesktopIpcError {
  return error instanceof SourceCodexDesktopIpcError
    ? error
    : new SourceCodexDesktopIpcError(
        error instanceof Error
          ? `The Codex Desktop connection failed: ${error.message}`
          : "The Codex Desktop connection failed.",
      );
}
