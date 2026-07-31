import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, it, vi } from "vitest";

import {
  DESIGN_SPACE_CONTROL_CLI_PATH,
  DESIGN_SPACE_CONTROL_EVENT,
  DESIGN_SPACE_CONTROL_PATH,
} from "../shared/workspace-control";
import { workspaceControlPlugin } from "./workspace-control-plugin";

function createPluginServer() {
  const send = vi.fn();
  const plugin = workspaceControlPlugin();
  let handler: ((request: IncomingMessage, response: ServerResponse, next: () => void) => void) | undefined;
  (plugin.configureServer as Function)({
    middlewares: { use: (callback: typeof handler) => { handler = callback; } },
    ws: { send },
  });
  const server = createServer((request, response) => handler?.(request, response, () => {
    response.statusCode = 404;
    response.end();
  }));
  return { send, server };
}

it("serves a no-install Bun CLI tied to the current Design Space origin", async () => {
  const { server } = createPluginServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${DESIGN_SPACE_CONTROL_CLI_PATH}`);
    const source = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(source).toContain("#!/usr/bin/env bun");
    expect(source).toContain(`http://127.0.0.1:${port}${DESIGN_SPACE_CONTROL_PATH}`);
    expect(source).toContain("panel <left|right> <open|close|toggle>");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

it("validates commands and sends typed IPC over the Vite websocket", async () => {
  const { send, server } = createPluginServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${port}${DESIGN_SPACE_CONTROL_PATH}`;
  try {
    const invalid = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "workspace-panel", side: "middle", action: "open", scope: "top" }),
    });
    expect(invalid.status).toBe(422);
    expect(send).not.toHaveBeenCalled();

    const command = { type: "workspace-panel", side: "right", action: "open", scope: "top" } as const;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, command });
    expect(send).toHaveBeenCalledWith({ type: "custom", event: DESIGN_SPACE_CONTROL_EVENT, data: command });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

it("rejects non-local authorities and cross-origin callers", async () => {
  const plugin = workspaceControlPlugin();
  let handler: Function | undefined;
  (plugin.configureServer as Function)({
    middlewares: { use: (callback: Function) => { handler = callback; } },
    ws: { send: vi.fn() },
  });
  const server = createServer((request, response) => handler?.(request, response, () => response.end()));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${DESIGN_SPACE_CONTROL_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: "{}",
    });
    expect(response.status).toBe(403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
