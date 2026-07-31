import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";

import type { Plugin } from "vite";

import {
  DESIGN_SPACE_CONTROL_CLI_PATH,
  DESIGN_SPACE_CONTROL_EVENT,
  DESIGN_SPACE_CONTROL_PATH,
  parseWorkspaceControlCommand,
} from "../shared/workspace-control";

const maximumBodyBytes = 4_096;

export function workspaceControlPlugin(): Plugin {
  return {
    name: "design-space-workspace-control",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = requestUrl(request);
        if (!url || (url.pathname !== DESIGN_SPACE_CONTROL_PATH && url.pathname !== DESIGN_SPACE_CONTROL_CLI_PATH)) {
          next();
          return;
        }
        if (!requestIsLocal(request)) {
          respondJson(response, 403, { ok: false, error: "Local Design Space requests only" });
          return;
        }
        if (url.pathname === DESIGN_SPACE_CONTROL_CLI_PATH) {
          if (request.method !== "GET") {
            response.setHeader("Allow", "GET");
            respondJson(response, 405, { ok: false, error: "GET required" });
            return;
          }
          respondCli(response, controlCliSource(request));
          return;
        }
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          respondJson(response, 405, { ok: false, error: "POST required" });
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
          respondJson(response, 415, { ok: false, error: "application/json required" });
          return;
        }
        const command = parseWorkspaceControlCommand(await readJsonBody(request));
        if (!command) {
          respondJson(response, 422, { ok: false, error: "Invalid workspace control command" });
          return;
        }
        server.ws.send({ type: "custom", event: DESIGN_SPACE_CONTROL_EVENT, data: command });
        respondJson(response, 200, { ok: true, command });
      });
    },
  };
}

export function controlCliSource(request: IncomingMessage): string {
  const serverUrl = publicServerUrl(request);
  return `#!/usr/bin/env bun
const usage = [
  "Usage:",
  "  curl -fsSL ${serverUrl}${DESIGN_SPACE_CONTROL_CLI_PATH} | bun - panel <left|right> <open|close|toggle>",
  "  curl -fsSL ${serverUrl}${DESIGN_SPACE_CONTROL_CLI_PATH} | bun - component isolate <name>",
].join("\\n");
const [resource, first, second, ...extra] = process.argv.slice(2);
if (resource === "--help" || resource === "-h") {
  console.log(usage);
  process.exit(0);
}
const panelCommand = resource === "panel"
  && ["left", "right"].includes(first)
  && ["open", "close", "toggle"].includes(second)
  && extra.length === 0;
const componentCommand = resource === "component"
  && first === "isolate"
  && typeof second === "string"
  && second.length > 0
  && extra.length === 0;
if (!panelCommand && !componentCommand) {
  console.error(usage);
  process.exit(2);
}
const command = panelCommand
  ? { type: "workspace-panel", side: first, action: second, scope: "top" }
  : { type: "workspace-component", name: second, action: "isolate", scope: "top" };
const response = await fetch(${JSON.stringify(`${serverUrl}${DESIGN_SPACE_CONTROL_PATH}`)}, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(command),
});
const result = await response.json().catch(() => ({}));
if (!response.ok || !result.ok) {
  console.error(result.error ?? \`Design Space returned HTTP \${response.status}\`);
  process.exit(1);
}
console.log(panelCommand
  ? \`Sent \${second} command for the \${first} panel to Design Space.\`
  : \`Sent isolate command for component \${second} to Design Space.\`);
`;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength > maximumBodyBytes) return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maximumBodyBytes) return undefined;
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

function publicServerUrl(request: IncomingMessage): string {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProtocol === "string" && forwardedProtocol.split(",")[0]?.trim() === "https"
    ? "https"
    : "http";
  return `${protocol}://${request.headers.host}`;
}

function requestUrl(request: IncomingMessage): URL | undefined {
  try {
    return new URL(request.url ?? "/", "http://design-space.local");
  } catch {
    return undefined;
  }
}

function requestIsLocal(request: IncomingMessage): boolean {
  const host = normalizedHostname(request.headers.host ?? "");
  if (!host || !isTrustedLocalHostname(host)) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === request.headers.host?.toLowerCase();
  } catch {
    return false;
  }
}

function normalizedHostname(authority: string): string | undefined {
  try {
    return new URL(`http://${authority}`).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  } catch {
    return undefined;
  }
}

function isTrustedLocalHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".ts.net")) return true;
  const family = isIP(hostname);
  if (family === 4) {
    const [first, second] = hostname.split(".").map(Number);
    return first === 127 || (first === 100 && second >= 64 && second <= 127);
  }
  return family === 6 && (hostname === "::1" || hostname.startsWith("fd7a:115c:a1e0:"));
}

function respondJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function respondCli(response: ServerResponse, source: string): void {
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Disposition", "inline; filename=design-space-control.ts");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(source);
}
