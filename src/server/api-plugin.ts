import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin } from "vite";

import { DesignSpaceError } from "./errors";
import type { EditService } from "./edit-service";

export const DESIGN_SPACE_API_PATH = "/__design-space/api";
const maximumBodyBytes = 16_384;

function respond(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function requestIsSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
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
    case "VALIDATION_ERROR":
    case "INVALID_TAILWIND":
      return 422;
    case "CHALLENGE_EXPIRED":
      return 410;
    default:
      return 400;
  }
}

export function designSpaceApiPlugin(service: EditService): Plugin {
  return {
    name: "design-space-local-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://design-space.local").pathname;
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
