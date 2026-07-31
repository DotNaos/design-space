import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  inspectSourceCodexOrigin,
  requestedSourceCodexThreadId,
  SourceCodexTaskUnavailableError,
} from "./source-codex-feedback-client";

const threadId = "019f651f-2bca-7513-9be5-857cb5fb86e6";

describe("source Codex feedback client", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("design-space.codex-task.v2", JSON.stringify({ threadId }));
    vi.unstubAllGlobals();
  });

  it("reconnects a persisted task after a transient unavailable response", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(apiResponse(404, { error: `thread not found: ${threadId}`, ok: false }))
      .mockResolvedValueOnce(apiResponse(200, {
        data: task(),
        ok: true,
      }));
    vi.stubGlobal("fetch", fetch);

    await expect(inspectSourceCodexOrigin()).resolves.toMatchObject({
      threadId,
      writable: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(requestedSourceCodexThreadId()).toBe(threadId);
  });

  it("keeps the selected task id when both reconnect attempts fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(
      apiResponse(404, { error: `thread not found: ${threadId}`, ok: false }),
    )));

    await expect(inspectSourceCodexOrigin()).rejects.toEqual(
      expect.objectContaining<Partial<SourceCodexTaskUnavailableError>>({
        name: "SourceCodexTaskUnavailableError",
        threadId,
      }),
    );
    expect(requestedSourceCodexThreadId()).toBe(threadId);
  });
});

function task() {
  return {
    cwd: "/Users/oli/projects/design-space",
    status: "active",
    threadId,
    title: "#10 · Ares · Fix Codex chat picker",
    writable: true,
  };
}

function apiResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
