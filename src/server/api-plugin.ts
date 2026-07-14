import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";

import type { Plugin } from "vite";

import { DesignSpaceError } from "./errors";
import type { OperationExecutor } from "./local-operation-service";

export const DESIGN_SPACE_API_PATH = "/__design-space/api";
const VITE_OPEN_IN_EDITOR_PATH = "/__open-in-editor";
const maximumBodyBytes = 2_097_152;

function respond(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function normalizedHostname(authority: string): string | undefined {
  try {
    const parsed = new URL(`http://${authority}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
    return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  } catch {
    return undefined;
  }
}

function isTrustedLocalHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".ts.net")) return true;
  const addressFamily = isIP(hostname);
  if (addressFamily === 4) {
    const [first, second] = hostname.split(".").map(Number);
    return first === 127 || (first === 100 && second >= 64 && second <= 127);
  }
  if (addressFamily === 6) {
    return hostname === "::1" || hostname.startsWith("fd7a:115c:a1e0:");
  }
  return false;
}

function requestIsSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!host || !isTrustedLocalHostname(normalizedHostname(host) ?? "")) return false;
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    return (
      (parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:") &&
      parsedOrigin.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}

function requestPathname(request: IncomingMessage): string | undefined {
  try {
    return new URL(request.url ?? "/", "http://design-space.local").pathname;
  } catch {
    return undefined;
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength > maximumBodyBytes) {
    throw new DesignSpaceError("INVALID_REQUEST", "The request body is too large");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maximumBodyBytes) {
      throw new DesignSpaceError("INVALID_REQUEST", "The request body is too large");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DesignSpaceError("INVALID_REQUEST", "The request body must be valid JSON");
  }
}

function errorStatus(error: DesignSpaceError): number {
  switch (error.code) {
    case "NOT_FOUND":
      return 404;
    case "STALE_SOURCE":
      return 409;
    case "ACCESS_DENIED":
      return 403;
    case "COMPILE_ERROR":
    case "INVALID_DOCUMENT":
    case "VALIDATION_ERROR":
    case "INVALID_TAILWIND":
      return 422;
    case "CHALLENGE_EXPIRED":
      return 410;
    case "TRANSACTION_FAILED":
      return 409;
    default:
      return 400;
  }
}

export function designSpaceApiPlugin(service: OperationExecutor): Plugin {
  return {
    name: "design-space-local-api",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("close", () => service.dispose?.());
      server.middlewares.use(async (request, response, next) => {
        response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        const pathname = requestPathname(request);
        if (pathname === undefined) {
          respond(response, 400, {
            ok: false,
            error: { code: "INVALID_REQUEST", message: "The request target is invalid" },
          });
          return;
        }
        if (pathname.startsWith(VITE_OPEN_IN_EDITOR_PATH)) {
          respond(response, 403, {
            ok: false,
            error: { code: "ACCESS_DENIED", message: "Browser-selected editor paths are disabled" },
          });
          return;
        }
        if (pathname !== DESIGN_SPACE_API_PATH) {
          next();
          return;
        }
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          respond(response, 405, { ok: false, error: { code: "INVALID_REQUEST", message: "POST required" } });
          return;
        }
        if (!requestIsSameOrigin(request)) {
          respond(response, 403, {
            ok: false,
            error: { code: "ACCESS_DENIED", message: "Cross-origin requests are not allowed" },
          });
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
          respond(response, 415, {
            ok: false,
            error: { code: "INVALID_REQUEST", message: "application/json required" },
          });
          return;
        }
        try {
          const data = await service.execute(await readJsonBody(request));
          respond(response, 200, { ok: true, data });
        } catch (error) {
          const safeError =
            error instanceof DesignSpaceError
              ? error
              : new DesignSpaceError("VALIDATION_ERROR", "The local operation failed");
          respond(response, errorStatus(safeError), {
            ok: false,
            error: { code: safeError.code, message: safeError.message },
          });
        }
      });
    },
  };
}
