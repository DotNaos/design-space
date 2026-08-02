import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";

import type { Plugin } from "vite";

import { SourceCodexAppServerError } from "./source-codex-app-server";
import { storeSourceCodexImage } from "./source-codex-attachments";
import { SourceCodexService } from "./source-codex-service";

export const SOURCE_CODEX_API_PATH = "/__design-space/codex";
const maximumBodyBytes = 12 * 1024 * 1024;

type CodexRequest =
  | { operation: "connect"; threadId: string }
  | { operation: "conversation"; threadId: string }
  | { operation: "create"; cwd?: string }
  | { operation: "inspect"; threadId: string }
  | { operation: "list"; query?: string }
  | { localImagePaths?: string[]; message: string; operation: "send"; threadId: string }
  | { dataUrl: string; fileName?: string; mediaType: string; operation: "upload-image" };

export function sourceCodexPlugin(service: SourceCodexService): Plugin {
  return {
    name: "design-space-source-codex",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("close", () => void service.close());
      server.middlewares.use(async (request, response, next) => {
        if (requestPathname(request) !== SOURCE_CODEX_API_PATH) {
          next();
          return;
        }
        setSecurityHeaders(response);
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          respond(response, 405, { ok: false, error: "POST required." });
          return;
        }
        if (!requestIsSameOrigin(request)) {
          respond(response, 403, { ok: false, error: "Cross-origin requests are not allowed." });
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
          respond(response, 415, { ok: false, error: "application/json required." });
          return;
        }
        try {
          const input = await readRequest(request);
          const data = await execute(service, input);
          respond(response, 200, { ok: true, data });
        } catch (error) {
          const safe = error instanceof SourceCodexAppServerError
            ? error
            : new SourceCodexAppServerError("The local Codex operation failed.");
          respond(response, safe.status, { ok: false, error: safe.message });
        }
      });
    },
  };
}

async function execute(service: SourceCodexService, input: CodexRequest): Promise<unknown> {
  switch (input.operation) {
    case "connect":
      return service.connectTask(input.threadId);
    case "conversation":
      return service.readConversation(input.threadId);
    case "list":
      return service.listTasks(input.query);
    case "inspect":
      return service.inspectTask(input.threadId);
    case "create":
      return service.createTask(input.cwd);
    case "send":
      return service.sendMessage(input.threadId, input.message, input.localImagePaths);
    case "upload-image":
      return storeSourceCodexImage(input);
  }
}

async function readRequest(request: IncomingMessage): Promise<CodexRequest> {
  const declaredLength = Number(request.headers["content-length"] ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength > maximumBodyBytes) {
    throw new SourceCodexAppServerError("The request body is too large.", 413);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maximumBodyBytes) throw new SourceCodexAppServerError("The request body is too large.", 413);
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SourceCodexAppServerError("The request body must be valid JSON.", 400);
  }
  if (!isRecord(value) || typeof value.operation !== "string") {
    throw new SourceCodexAppServerError("The Codex operation is invalid.", 400);
  }
  if (value.operation === "list") {
    return { operation: "list", query: optionalString(value.query) };
  }
  if (value.operation === "create") {
    return { operation: "create", cwd: optionalString(value.cwd) };
  }
  if (
    (value.operation === "connect" || value.operation === "inspect" || value.operation === "conversation")
    && typeof value.threadId === "string"
  ) {
    return { operation: value.operation, threadId: value.threadId };
  }
  if (value.operation === "send" && typeof value.threadId === "string" && typeof value.message === "string") {
    return {
      localImagePaths: optionalStringArray(value.localImagePaths),
      message: value.message,
      operation: "send",
      threadId: value.threadId,
    };
  }
  if (
    value.operation === "upload-image"
    && typeof value.dataUrl === "string"
    && typeof value.mediaType === "string"
  ) {
    return {
      dataUrl: value.dataUrl,
      fileName: optionalString(value.fileName),
      mediaType: value.mediaType,
      operation: "upload-image",
    };
  }
  throw new SourceCodexAppServerError("The Codex operation is invalid.", 400);
}

function requestPathname(request: IncomingMessage): string | undefined {
  try {
    return new URL(request.url ?? "/", "http://design-space.local").pathname;
  } catch {
    return undefined;
  }
}

function requestIsSameOrigin(request: IncomingMessage): boolean {
  const host = request.headers.host;
  if (!host) return false;
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  } catch {
    return false;
  }
  if (!trustedLocalHostname(hostname)) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function trustedLocalHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".ts.net")) return true;
  const family = isIP(hostname);
  if (family === 4) {
    const [first, second] = hostname.split(".").map(Number);
    return first === 127 || (first === 100 && second >= 64 && second <= 127);
  }
  return family === 6 && (hostname === "::1" || hostname.startsWith("fd7a:115c:a1e0:"));
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function respond(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new SourceCodexAppServerError("The screenshot attachment list is invalid.", 400);
  }
  return value;
}
