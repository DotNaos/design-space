const sourceCodexApi = "/__design-space/codex";
const storageKey = "design-space.codex-task.v2";
const legacyStorageKey = "design-space.verified-codex-origin.v1";
const threadPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SourceCodexTaskStatus = "active" | "idle" | "not-loaded" | "unknown";

export interface SourceCodexOrigin {
  currentProject?: boolean;
  cwd?: string;
  repositoryLabel?: string;
  repositoryPath?: string;
  threadId: string;
  title: string;
  status: SourceCodexTaskStatus;
  updatedAt?: number;
  writable: boolean;
}

export type SourceCodexTask = SourceCodexOrigin;

export class SourceCodexTaskUnavailableError extends Error {
  readonly threadId?: string;

  constructor(threadId?: string) {
    super("The selected Codex task is no longer available. Choose another task to reconnect.");
    this.name = "SourceCodexTaskUnavailableError";
    this.threadId = threadId;
  }
}

export interface SourceCodexMessage {
  imageUrls?: readonly string[];
  role: "assistant" | "user";
  text: string;
}

export interface SourceCodexImageUpload {
  dataUrl: string;
  fileName: string;
  mediaType: string;
}

type ApiResult<Data> = {
  data?: Data;
  error?: string;
  ok: boolean;
};

export async function listSourceCodexTasks(query?: string): Promise<SourceCodexTask[]> {
  return request<SourceCodexTask[]>({ operation: "list", query });
}

export async function readSourceCodexConversation(threadId: string): Promise<SourceCodexMessage[]> {
  if (!threadPattern.test(threadId)) throw new Error("The selected Codex task id is invalid.");
  return request<SourceCodexMessage[]>({ operation: "conversation", threadId });
}

export async function inspectSourceCodexOrigin(): Promise<SourceCodexOrigin | undefined> {
  const threadId = requestedSourceCodexThreadId();
  if (!threadId) return undefined;
  try {
    // This id was explicitly selected earlier and persisted locally. Reconnect it
    // after a Design Space server restart so the composer stays usable.
    const task = await connectSourceCodexTask(threadId);
    storeThreadId(task.threadId);
    return task;
  } catch (error) {
    if (isUnavailableTask(error)) {
      // Codex and Design Space can finish starting in either order. Keep the
      // explicit selection and retry once before asking the user to reconnect.
      await delay(250);
      try {
        return await connectSourceCodexTask(threadId);
      } catch (retryError) {
        if (isUnavailableTask(retryError)) throw new SourceCodexTaskUnavailableError(threadId);
        throw retryError;
      }
    }
    throw error;
  }
}

export async function connectSourceCodexTask(threadId: string): Promise<SourceCodexTask> {
  if (!threadPattern.test(threadId)) throw new Error("The selected Codex task id is invalid.");
  const task = await request<SourceCodexTask>({ operation: "connect", threadId });
  storeThreadId(task.threadId);
  return task;
}

export async function createSourceCodexTask(cwd?: string): Promise<SourceCodexTask> {
  const task = await request<SourceCodexTask>({ cwd, operation: "create" });
  storeThreadId(task.threadId);
  return task;
}

export function clearStoredSourceCodexTask(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(legacyStorageKey);
}

export async function sendSourceCodexFeedback(
  origin: SourceCodexOrigin,
  message: string,
  localImagePaths: readonly string[] = [],
): Promise<void> {
  try {
    await request({ localImagePaths, message, operation: "send", threadId: origin.threadId });
  } catch (error) {
    if (isUnavailableTask(error)) {
      throw new SourceCodexTaskUnavailableError(origin.threadId);
    }
    throw error;
  }
}

export async function uploadSourceCodexImage(image: SourceCodexImageUpload): Promise<{ path: string }> {
  return request({ ...image, operation: "upload-image" });
}

async function inspectSourceCodexTask(threadId: string): Promise<SourceCodexTask> {
  if (!threadPattern.test(threadId)) throw new Error("The selected Codex task id is invalid.");
  return request<SourceCodexTask>({ operation: "inspect", threadId });
}

export function requestedSourceCodexThreadId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const query = new URLSearchParams(window.location.search);
  const fromQuery = query.get("thread") ?? query.get("threadId");
  if (fromQuery && threadPattern.test(fromQuery)) return fromQuery;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as { threadId?: string };
    if (stored.threadId && threadPattern.test(stored.threadId)) return stored.threadId;
    const legacy = JSON.parse(window.localStorage.getItem(legacyStorageKey) ?? "{}") as { threadId?: string };
    return legacy.threadId && threadPattern.test(legacy.threadId) ? legacy.threadId : undefined;
  } catch {
    return undefined;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function storeThreadId(threadId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify({ threadId }));
  window.localStorage.removeItem(legacyStorageKey);
}

function isUnavailableTask(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thread not found|selected Codex task (is )?no longer available|selected Codex task was not found/i.test(message);
}

async function request<Data>(input: Record<string, unknown>): Promise<Data> {
  const response = await fetchWithTimeout(sourceCodexApi, {
    body: JSON.stringify(input),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  let result: ApiResult<Data>;
  try {
    result = await response.json() as ApiResult<Data>;
  } catch {
    throw new Error("The local Codex connection returned an invalid response.");
  }
  if (!response.ok || !result.ok || result.data === undefined) {
    throw new Error(result.error ?? `The local Codex operation failed (${response.status}).`);
  }
  return result.data;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The local Codex connection timed out.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
