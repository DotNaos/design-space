import { EventEmitter } from "node:events";
import { createServer, request as requestHttp } from "node:http";
import { connect, type AddressInfo } from "node:net";

import { expect, it } from "vitest";

import { DESIGN_SPACE_API_PATH, designSpaceApiPlugin } from "./api-plugin";

function postWithAuthority(url: string, authority: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = requestHttp(url, {
      method: "POST",
      headers: {
        host: authority,
        "content-type": "application/json",
        origin: `http://${authority}`,
      },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    });
    request.on("error", reject);
    request.end(body);
  });
}

function rawRequest(port: number, target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    let response = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.end(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
  });
}

it("guards the single local endpoint before dispatching typed operations", async () => {
  const executed: unknown[] = [];
  const plugin = designSpaceApiPlugin({
    execute: async (value: unknown) => {
      executed.push(value);
      return { editTargetId: "card", value: "p-4", version: "a".repeat(64) };
    },
  } as never);
  let handler: Function | undefined;
  let nextCalls = 0;
  (plugin.configureServer as Function)({
    middlewares: {
      use: (callback: Function) => {
        handler = callback;
      },
    },
  });
  const server = createServer((request, response) =>
    handler?.(request, response, () => {
      nextCalls += 1;
      response.statusCode = 404;
      response.end();
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}${DESIGN_SPACE_API_PATH}`;

  try {
    const malformed = await rawRequest(port, "//[");
    expect(malformed).toContain("HTTP/1.1 400");
    expect(malformed).toContain('"code":"INVALID_REQUEST"');
    expect(nextCalls).toBe(0);
    const openInEditor = await fetch(`${new URL(url).origin}/__open-in-editor?file=/etc/passwd`);
    expect(openInEditor.status).toBe(403);
    expect(await openInEditor.json()).toMatchObject({ error: { code: "ACCESS_DENIED" } });
    expect(nextCalls).toBe(0);
    const suffix = await fetch(`${url}/arbitrary`, { method: "POST" });
    expect(suffix.status).toBe(404);
    expect(nextCalls).toBe(1);
    const wrongType = await fetch(url, { method: "POST", body: "{}", headers: { "content-type": "text/plain" } });
    expect(wrongType.status).toBe(415);
    const crossOrigin = await fetch(url, {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
    });
    expect(crossOrigin.status).toBe(403);
    expect(await postWithAuthority(url, "evil.example", "{}")).toBe(403);
    const trustedBody = JSON.stringify({ type: "read-source", editTargetId: "edit.card.surface" });
    expect(await postWithAuthority(url, "100.80.135.9:8086", trustedBody)).toBe(200);
    expect(await postWithAuthority(url, "design-space.localhost:1355", trustedBody)).toBe(200);
    const valid = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ type: "read-source", editTargetId: "edit.card.surface" }),
      headers: { "content-type": "application/json" },
    });
    expect(valid.status).toBe(200);
    expect(valid.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    expect(valid.headers.get("x-frame-options")).toBe("DENY");
    expect(await valid.json()).toMatchObject({ ok: true, data: { value: "p-4" } });
    expect(executed).toEqual([
      { type: "read-source", editTargetId: "edit.card.surface" },
      { type: "read-source", editTargetId: "edit.card.surface" },
      { type: "read-source", editTargetId: "edit.card.surface" },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

it("disposes the local operation service when the Vite server closes", () => {
  const httpServer = new EventEmitter();
  let disposals = 0;
  const plugin = designSpaceApiPlugin({
    execute: async () => undefined,
    dispose: () => {
      disposals += 1;
    },
  });

  (plugin.configureServer as Function)({
    httpServer,
    middlewares: { use() {} },
  });
  httpServer.emit("close");
  httpServer.emit("close");

  expect(disposals).toBe(1);
});
