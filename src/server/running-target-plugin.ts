import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin } from "vite";

import { DESIGN_SPACE_HEALTH_PATH, DESIGN_SPACE_INSTANCES_PATH } from "../shared/running-targets";
import { RunningTargetRegistry } from "./running-target-registry";

export function runningTargetPlugin(project: { id: string; label: string }): Plugin {
  const registry = new RunningTargetRegistry(
    project,
    process.env.DESIGN_SPACE_VIA_PORTLESS === "1" ? process.env.PORTLESS_URL : undefined,
  );
  return {
    name: "design-space-running-targets",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("listening", () => void registry.start());
      server.httpServer?.once("close", () => void registry.stop());
      server.middlewares.use(async (request, response, next) => {
        const url = requestUrl(request);
        if (!url || (url.pathname !== DESIGN_SPACE_INSTANCES_PATH && url.pathname !== DESIGN_SPACE_HEALTH_PATH)) {
          next();
          return;
        }
        secureJson(response);
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: "GET required" }));
          return;
        }
        if (url.pathname === DESIGN_SPACE_HEALTH_PATH) {
          if (!registry.acceptsHealthToken(url.searchParams.get("token") ?? undefined)) {
            response.statusCode = 403;
            response.end(JSON.stringify({ error: "Invalid health token" }));
            return;
          }
          response.end(JSON.stringify(registry.healthPayload()));
          return;
        }
        if (!requestIsSameOrigin(request)) {
          response.statusCode = 403;
          response.end(JSON.stringify({ error: "Cross-origin requests are not allowed" }));
          return;
        }
        response.end(JSON.stringify({ instances: await registry.verifiedTargets() }));
      });
    },
  };
}

function requestUrl(request: IncomingMessage): URL | undefined {
  try { return new URL(request.url ?? "/", "http://design-space.local"); } catch { return undefined; }
}

function requestIsSameOrigin(request: IncomingMessage): boolean {
  const host = request.headers.host;
  const origin = request.headers.origin;
  if (!host || !host.toLowerCase().split(":")[0]?.endsWith(".localhost")) return false;
  if (!origin) return true;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { return false; }
}

function secureJson(response: ServerResponse): void {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}
