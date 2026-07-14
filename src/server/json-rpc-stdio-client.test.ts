import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  JsonRpcMethodNotFoundError,
  JsonRpcStdioClient,
} from "./json-rpc-stdio-client";

function frame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`), body]);
}

function messagesFrom(buffer: Buffer): unknown[] {
  const messages: unknown[] = [];
  let offset = 0;
  while (offset < buffer.byteLength) {
    const headerEnd = buffer.indexOf("\r\n\r\n", offset);
    if (headerEnd < 0) break;
    const header = buffer.subarray(offset, headerEnd).toString("ascii");
    const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1]);
    const bodyStart = headerEnd + 4;
    if (!Number.isSafeInteger(length) || bodyStart + length > buffer.byteLength) break;
    messages.push(JSON.parse(buffer.subarray(bodyStart, bodyStart + length).toString("utf8")));
    offset = bodyStart + length;
  }
  return messages;
}

function harness(options: { onRequest?: (method: string, params: unknown) => unknown | Promise<unknown> } = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const client = new JsonRpcStdioClient({ input, output, onRequest: options.onRequest });
  return { input, client, messages: () => messagesFrom(Buffer.concat(chunks)) };
}

describe("JsonRpcStdioClient", () => {
  it("frames requests and accepts fragmented responses", async () => {
    const { client, input, messages } = harness();
    const result = client.request<{ ready: boolean }>("initialize", { root: "trusted" });
    expect(messages()).toEqual([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { root: "trusted" } },
    ]);

    const response = frame({ jsonrpc: "2.0", id: 1, result: { ready: true } });
    input.write(response.subarray(0, 11));
    input.write(response.subarray(11, 29));
    input.write(response.subarray(29));
    await expect(result).resolves.toEqual({ ready: true });
    client.dispose();
  });

  it("answers supported server requests and rejects unknown methods", async () => {
    const { client, input, messages } = harness({
      onRequest: (method) => {
        if (method === "workspace/configuration") return [{ tabSize: 2 }];
        throw new JsonRpcMethodNotFoundError(method);
      },
    });
    input.write(frame({ jsonrpc: "2.0", id: "config", method: "workspace/configuration", params: {} }));
    input.write(frame({ jsonrpc: "2.0", id: 7, method: "browser/runCommand", params: { command: "unsafe" } }));
    await new Promise((resolve) => setImmediate(resolve));

    expect(messages()).toContainEqual({ jsonrpc: "2.0", id: "config", result: [{ tabSize: 2 }] });
    expect(messages()).toContainEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32601, message: "Method not found" },
    });
    client.dispose();
  });

  it("closes and rejects pending work when an incoming message exceeds its bound", async () => {
    const { client, input } = harness();
    const pending = client.request("initialize", {});
    input.write("Content-Length: 20000000\r\n\r\n");
    await expect(pending).rejects.toThrow("size limit");
    await expect(client.request("after-close", {})).rejects.toThrow("closed");
  });
});
