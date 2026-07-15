import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalOperationError, runLocalOperation } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(result: Response | Promise<never>) {
  globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(result)) as unknown as typeof fetch;
}

describe("runLocalOperation", () => {
  it("returns a successful local operation result", async () => {
    mockFetch(new Response(JSON.stringify({
      ok: true,
      data: { value: "p-4", css: ".p-4{}" },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(runLocalOperation({ type: "compile-tailwind", value: "p-4" })).resolves.toMatchObject({
      value: "p-4",
    });
  });

  it("preserves structured errors from the local runtime", async () => {
    mockFetch(new Response(JSON.stringify({
      ok: false,
      error: { code: "INVALID_INPUT", message: "That utility is not allowed." },
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));

    await expect(runLocalOperation({ type: "compile-tailwind", value: "p-[13px]" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "That utility is not allowed.",
    });
  });

  it("reports an unavailable local server instead of leaking an HTML JSON parse error", async () => {
    mockFetch(new Response("<!DOCTYPE html><title>Bad Gateway</title>", {
      status: 502,
      headers: { "content-type": "text/html" },
    }));

    const result = runLocalOperation({ type: "compile-tailwind", value: "p-4" });

    await expect(result).rejects.toBeInstanceOf(LocalOperationError);
    await expect(result).rejects.toMatchObject({
      code: "LOCAL_RUNTIME_UNAVAILABLE",
      message: "The local Design Space server is unavailable. Restart the dev server and try again.",
      details: { status: "502" },
    });
  });

  it("reports an unavailable local server when the request cannot connect", async () => {
    mockFetch(Promise.reject(new TypeError("Failed to fetch")));

    await expect(runLocalOperation({ type: "compile-tailwind", value: "p-4" })).rejects.toMatchObject({
      code: "LOCAL_RUNTIME_UNAVAILABLE",
      message: "The local Design Space server is unavailable. Restart the dev server and try again.",
    });
  });
});
