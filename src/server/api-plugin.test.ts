import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, it } from "vitest";

import { DESIGN_SPACE_API_PATH, designSpaceApiPlugin } from "./api-plugin";

it("guards the single local endpoint before dispatching typed operations", async () => {
  const executed: unknown[] = [];
  const plugin = designSpaceApiPlugin({
    execute: async (value: unknown) => {
      executed.push(value);
      return { editTargetId: "card", value: "p-4", version: "a".repeat(64) };
    },
  } as never);
  let handler: Function | undefined;
  (plugin.configureServer as Function)({
    middlewares: {
      use: (callback: Function) => {
        handler = callback;
      },
    },
  });
  const server = createServer((request, response) =>
    handler?.(request, response, () => {
      response.statusCode = 404;
      response.end();
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}${DESIGN_SPACE_API_PATH}`;

  try {
    const suffix = await fetch(`${url}/arbitrary`, { method: "POST" });
    expect(suffix.status).toBe(404);
    const wrongType = await fetch(url, { method: "POST", body: "{}", headers: { "content-type": "text/plain" } });
    expect(wrongType.status).toBe(415);
    const crossOrigin = await fetch(url, {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
    });
    expect(crossOrigin.status).toBe(403);
    const valid = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ type: "read-source", editTargetId: "edit.card.surface" }),
      headers: { "content-type": "application/json" },
    });
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ ok: true, data: { value: "p-4" } });
    expect(executed).toEqual([{ type: "read-source", editTargetId: "edit.card.surface" }]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
