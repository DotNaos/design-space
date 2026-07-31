import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { SourceCodexRpcClient } from "./source-codex-app-server";
import type {
  SourceCodexDesktopMessageClient,
  SourceCodexDesktopMessageInput,
} from "./source-codex-desktop-ipc";
import {
  readBoundedConversation,
  sanitizeSourceCodexConversationText,
  SourceCodexService,
} from "./source-codex-service";
import { storeSourceCodexImage } from "./source-codex-attachments";

const threadId = "019f651f-2bca-7513-9be5-857cb5fb86e6";

class FakeCodexClient implements SourceCodexRpcClient {
  readonly calls: Array<{ method: string; params?: unknown }> = [];
  readonly results = new Map<string, unknown>();
  readonly failures = new Map<string, Error[]>();

  async call<Result>(method: string, params?: unknown): Promise<Result> {
    this.calls.push({ method, params });
    const failures = this.failures.get(method);
    const failure = failures?.shift();
    if (failure) throw failure;
    return this.results.get(method) as Result;
  }

  async close(): Promise<void> {}
}

class FakeDesktopClient implements SourceCodexDesktopMessageClient {
  readonly calls: Array<{
    input: SourceCodexDesktopMessageInput;
    method: "start" | "steer";
  }> = [];
  failure?: Error;

  async startTurn(input: SourceCodexDesktopMessageInput): Promise<void> {
    this.calls.push({ input, method: "start" });
    if (this.failure) throw this.failure;
  }

  async steerTurn(input: SourceCodexDesktopMessageInput): Promise<void> {
    this.calls.push({ input, method: "steer" });
    if (this.failure) throw this.failure;
  }
}

describe("SourceCodexService", () => {
  it("keeps user requests while hiding host-only conversation context", () => {
    expect(sanitizeSourceCodexConversationText(`
<in-app-browser-context source="ambient-ui-state">
Current URL: http://design-space.localhost:1355/
</in-app-browser-context>

Please fix the selected component.
    `)).toBe("Please fix the selected component.");
    expect(sanitizeSourceCodexConversationText(`
<recommended_plugins>Plugins</recommended_plugins>
# AGENTS.md instructions
Internal project instructions
    `)).toBe("");
    expect(sanitizeSourceCodexConversationText(`
Keep this message.
<image name=[Image #1] path="/tmp/screenshot.png">
<oai-mem-citation><citation_entries>internal</citation_entries></oai-mem-citation>
    `)).toBe("Keep this message.");
    expect(sanitizeSourceCodexConversationText(`
# Files mentioned by the user:

## screenshot.png: /tmp/screenshot.png

## My request for Codex:
The screenshot message should appear once.
</image>
    `)).toBe("The screenshot message should appear once.");
    expect(sanitizeSourceCodexConversationText(`
<codex_internal_context>
Internal transport metadata
</codex_internal_context>
    `)).toBe("");
  });

  it("finds recent messages across very large JSONL records", async () => {
    const sessionsRoot = resolve(homedir(), ".codex", "sessions");
    await mkdir(sessionsRoot, { recursive: true });
    const folder = await mkdtemp(resolve(sessionsRoot, "design-space-history-test-"));
    const path = resolve(folder, `rollout-test-${threadId}.jsonl`);
    const message = (role: "assistant" | "user", text: string) => JSON.stringify({
      payload: { content: [{ text, type: role === "user" ? "input_text" : "output_text" }], role, type: "message" },
      type: "response_item",
    });
    const oversizedUnrelatedRecord = JSON.stringify({
      payload: { output: "x".repeat(5 * 1024 * 1024), type: "function_call_output" },
      type: "response_item",
    });
    await writeFile(path, [
      message("user", "Older request"),
      oversizedUnrelatedRecord,
      message("assistant", "Older answer"),
      message("user", "Latest request\n<image name=[Image #1] path=\"/tmp/a.png\">"),
      message("assistant", "Latest answer"),
      "",
    ].join("\n"));

    try {
      await expect(readBoundedConversation(path, threadId)).resolves.toEqual([
        { role: "user", text: "Older request" },
        { role: "assistant", text: "Older answer" },
        { role: "user", text: "Latest request" },
        { role: "assistant", text: "Latest answer" },
      ]);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });

  it("lists and filters normalized local tasks within the app-server limit", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/list", {
      data: [
        {
          cwd: "/Users/oli/projects/design-space",
          id: threadId,
          name: "#10 · Ares · Codex session picker",
          status: { type: "active" },
          updatedAt: 123,
        },
        {
          cwd: "/tmp/other",
          id: "019fa322-11bb-74f2-8ea2-fcb755f68c04",
          name: "Different task",
          status: { type: "idle" },
        },
      ],
    });
    const service = new SourceCodexService(
      client,
      "/Users/oli/projects/design-space",
      async (cwd) => cwd.includes("design-space")
        ? { label: "design-space", path: "/Users/oli/projects/design-space" }
        : undefined,
    );

    await expect(service.listTasks("session picker")).resolves.toEqual([
      {
        currentProject: true,
        cwd: "/Users/oli/projects/design-space",
        repositoryLabel: "design-space",
        repositoryPath: "/Users/oli/projects/design-space",
        status: "active",
        threadId,
        title: "#10 · Ares · Codex session picker",
        updatedAt: 123,
        writable: false,
      },
    ]);
    expect(client.calls[0]).toEqual({
      method: "thread/list",
      params: {
        archived: false,
        limit: 50,
        sortDirection: "desc",
        sortKey: "updated_at",
      },
    });
  });

  it("creates a task in the configured project folder", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/start", {
      thread: {
        cwd: "/workspace",
        id: threadId,
        name: "Untitled task",
        status: "idle",
      },
    });
    const service = new SourceCodexService(client, "/workspace");

    await expect(service.createTask()).resolves.toMatchObject({ threadId, cwd: "/workspace" });
    expect(client.calls[0]).toEqual({
      method: "thread/start",
      params: {
        approvalPolicy: "on-request",
        cwd: "/workspace",
        ephemeral: false,
        sandbox: "workspace-write",
      },
    });
  });

  it("keeps a newly-created task connected while its history file is materializing", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/start", {
      thread: {
        cwd: "/workspace",
        id: threadId,
        name: "Connected task",
        status: "idle",
      },
    });
    client.failures.set("thread/read", [
      new Error("thread-store internal error: session metadata is empty"),
      new Error("thread-store internal error: session metadata is empty"),
    ]);
    const service = new SourceCodexService(client, "/workspace");
    const created = await service.createTask();

    await expect(service.inspectTask(threadId)).resolves.toEqual(created);
    await expect(service.readConversation(threadId)).resolves.toEqual([]);
  });

  it("sends directly through a task created by this Design Space process", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/start", {
      thread: {
        cwd: "/workspace",
        id: threadId,
        name: "Connected task",
        status: "idle",
      },
    });
    const service = new SourceCodexService(client, "/workspace");
    await service.createTask();
    client.calls.length = 0;

    await expect(service.sendMessage(threadId, "Please fix this layer.")).resolves.toEqual({ accepted: true });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({
      method: "turn/start",
      params: {
        input: [{ text: "Please fix this layer.", type: "text" }],
        threadId,
      },
    });
  });

  it("waits for a newly-created task file before sending its first message", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/start", {
      thread: {
        cwd: "/workspace",
        id: threadId,
        name: "Connected task",
        status: "idle",
      },
    });
    client.failures.set("turn/start", [
      new Error("thread-store internal error: session metadata is empty"),
    ]);
    const service = new SourceCodexService(client, "/workspace");
    await service.createTask();
    client.calls.length = 0;

    await expect(service.sendMessage(threadId, "First message.")).resolves.toEqual({ accepted: true });
    expect(client.calls.map((call) => call.method)).toEqual([
      "turn/start",
      "thread/read",
      "turn/start",
    ]);
  });

  it("reconciles a first message that was accepted before the task file became readable", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/start", {
      thread: {
        cwd: "/workspace",
        id: threadId,
        name: "Connected task",
        status: "idle",
      },
    });
    client.results.set("thread/read", {
      thread: {
        id: threadId,
        path: `/trusted/${threadId}.jsonl`,
      },
    });
    client.failures.set("turn/start", [
      new Error("thread-store internal error: session metadata is empty"),
    ]);
    const service = new SourceCodexService(
      client,
      "/workspace",
      async () => undefined,
      async () => [{ role: "user", text: "First message." }],
    );
    await service.createTask();
    client.calls.length = 0;

    await expect(service.sendMessage(threadId, "First message.")).resolves.toEqual({ accepted: true });
    expect(client.calls.map((call) => call.method)).toEqual(["turn/start", "thread/read"]);
  });

  it("rejects an external task immediately instead of waiting on another client's lock", async () => {
    const client = new FakeCodexClient();
    const service = new SourceCodexService(client, "/workspace");

    await expect(service.sendMessage(threadId, "Please fix this layer.")).rejects.toMatchObject({
      status: 409,
    });
    expect(client.calls).toEqual([]);
  });

  it("lets the user explicitly connect an existing task and send feedback to it", async () => {
    const client = new FakeCodexClient();
    const desktopClient = new FakeDesktopClient();
    client.results.set("thread/read", {
      thread: {
        cwd: "/workspace",
        id: threadId,
        name: "Existing task",
        status: "active",
      },
    });
    const service = new SourceCodexService(
      client,
      "/workspace",
      undefined,
      undefined,
      desktopClient,
    );

    await expect(service.connectTask(threadId)).resolves.toMatchObject({
      threadId,
      title: "Existing task",
      writable: true,
    });
    client.calls.length = 0;

    await expect(service.sendMessage(threadId, "Please fix this layer.")).resolves.toEqual({ accepted: true });
    expect(client.calls).toEqual([]);
    expect(desktopClient.calls).toEqual([
      {
        input: expect.objectContaining({
          cwd: "/workspace",
          prompt: "Please fix this layer.",
          threadId,
        }),
        method: "steer",
      },
    ]);
  });

  it("sends validated screenshots through the connected Codex Desktop task", async () => {
    const client = new FakeCodexClient();
    const desktopClient = new FakeDesktopClient();
    client.results.set("thread/read", {
      thread: { cwd: "/workspace", id: threadId, name: "Existing task", status: "active" },
    });
    const stored = await storeSourceCodexImage({
      dataUrl: `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString("base64")}`,
      fileName: "canvas.png",
      mediaType: "image/png",
    });
    const service = new SourceCodexService(client, "/workspace", undefined, undefined, desktopClient);
    await service.connectTask(threadId);

    try {
      await expect(service.sendMessage(threadId, "Inspect this screenshot.", [stored.path]))
        .resolves.toEqual({ accepted: true });
      expect(desktopClient.calls).toEqual([{
        input: expect.objectContaining({
          localImagePaths: [await realpath(stored.path)],
          prompt: "Inspect this screenshot.",
          threadId,
        }),
        method: "steer",
      }]);
    } finally {
      await rm(stored.path, { force: true });
    }
  });

  it("disconnects a task that disappears before its next message", async () => {
    const client = new FakeCodexClient();
    const desktopClient = new FakeDesktopClient();
    client.results.set("thread/read", {
      thread: { cwd: "/workspace", id: threadId, name: "Existing task", status: "active" },
    });
    desktopClient.failure = new Error("The owning Codex task is not available in the Desktop app.");
    const service = new SourceCodexService(
      client,
      "/workspace",
      undefined,
      undefined,
      desktopClient,
    );
    await service.connectTask(threadId);

    await expect(service.sendMessage(threadId, "Please fix this layer.")).rejects.toMatchObject({
      message: "The selected Codex task is no longer available. Choose another task to reconnect.",
      status: 410,
    });
    await expect(service.sendMessage(threadId, "Try again.")).rejects.toMatchObject({ status: 409 });
  });

  it("starts an idle existing task through its Codex Desktop owner", async () => {
    const client = new FakeCodexClient();
    const desktopClient = new FakeDesktopClient();
    client.results.set("thread/read", {
      thread: { cwd: "/workspace", id: threadId, name: "Existing task", status: "idle" },
    });
    const service = new SourceCodexService(
      client,
      "/workspace",
      undefined,
      undefined,
      desktopClient,
    );
    await service.connectTask(threadId);

    await expect(service.sendMessage(threadId, "Start this task.")).resolves.toEqual({ accepted: true });
    expect(desktopClient.calls).toEqual([
      {
        input: expect.objectContaining({
          cwd: "/workspace",
          prompt: "Start this task.",
          threadId,
        }),
        method: "start",
      },
    ]);
  });

  it("groups worktrees under their canonical repository and puts the open project first", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/list", {
      data: [
        {
          cwd: "/Users/oli/projects/.codex-worktrees/design-space-one",
          id: "019fa322-11bb-74f2-8ea2-fcb755f68c04",
          name: "Older worktree task",
          updatedAt: 1,
        },
        {
          cwd: "/Users/oli/projects/other",
          id: "019fa322-11bb-74f2-8ea2-fcb755f68c05",
          name: "Other repository task",
          updatedAt: 3,
        },
        {
          cwd: "/Users/oli/projects/design-space",
          id: threadId,
          name: "Current repository task",
          updatedAt: 2,
        },
      ],
    });
    const service = new SourceCodexService(
      client,
      "/Users/oli/projects/design-space",
      async (cwd) => cwd.includes("design-space")
        ? { label: "design-space", path: "/Users/oli/projects/design-space" }
        : { label: "other", path: "/Users/oli/projects/other" },
    );

    const tasks = await service.listTasks();
    expect(tasks.map((task) => [task.title, task.repositoryPath, task.currentProject])).toEqual([
      ["Current repository task", "/Users/oli/projects/design-space", true],
      ["Older worktree task", "/Users/oli/projects/design-space", true],
      ["Other repository task", "/Users/oli/projects/other", false],
    ]);
  });

  it("reads a bounded conversation without asking the app server for full turns", async () => {
    const client = new FakeCodexClient();
    client.results.set("thread/read", {
      thread: {
        id: threadId,
        path: `/trusted/${threadId}.jsonl`,
      },
    });
    const service = new SourceCodexService(
      client,
      "/workspace",
      async () => undefined,
      async () => [
        { role: "user", text: "Please fix it." },
        { role: "assistant", text: "I am working on it." },
      ],
    );

    await expect(service.readConversation(threadId)).resolves.toEqual([
      { role: "user", text: "Please fix it." },
      { role: "assistant", text: "I am working on it." },
    ]);
    expect(client.calls).toEqual([
      {
        method: "thread/read",
        params: { includeTurns: false, threadId },
      },
    ]);
  });
});
