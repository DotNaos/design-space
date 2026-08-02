import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  SourceCodexAppServerClient,
  SourceCodexAppServerError,
  type SourceCodexRpcClient,
} from "./source-codex-app-server";
import {
  SourceCodexDesktopIpcClient,
  type SourceCodexDesktopMessageClient,
} from "./source-codex-desktop-ipc";
import { validateSourceCodexImagePaths } from "./source-codex-attachments";

const threadPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const execFileAsync = promisify(execFile);
const historyChunkBytes = 1024 * 1024;
const maximumHistoryLineBytes = 16 * 1024 * 1024;
const maximumHistoryScanBytes = 512 * 1024 * 1024;
const maximumHistoryMessages = 80;
const maximumMessageCharacters = 12_000;
const newThreadRetryDelays = [100, 200, 400, 800, 1_600, 2_400] as const;

const conversationCache = new Map<string, {
  messages: readonly SourceCodexMessage[];
  size: number;
}>();

type UnknownRecord = Record<string, unknown>;

export type SourceCodexTask = {
  currentProject?: boolean;
  cwd?: string;
  repositoryLabel?: string;
  repositoryPath?: string;
  status: "active" | "idle" | "not-loaded" | "unknown";
  threadId: string;
  title: string;
  updatedAt?: number;
  writable: boolean;
};

export type SourceCodexMessage = {
  role: "assistant" | "user";
  text: string;
};

type RepositoryEvidence = {
  label: string;
  path: string;
};

type RepositoryResolver = (cwd: string) => Promise<RepositoryEvidence | undefined>;
type HistoryReader = (path: string, threadId: string) => Promise<SourceCodexMessage[]>;

export class SourceCodexService {
  /**
   * Tasks deliberately connected from this local Design Space process.
   * Listing a task never grants write access; the explicit connect operation does.
   */
  private readonly connectedThreadIds = new Set<string>();
  private readonly connectedTasks = new Map<string, SourceCodexTask>();
  private readonly createdThreadIds = new Set<string>();

  constructor(
    private readonly client: SourceCodexRpcClient = new SourceCodexAppServerClient(),
    private readonly defaultCwd = process.cwd(),
    private readonly repositoryResolver: RepositoryResolver = resolveRepository,
    private readonly historyReader: HistoryReader = readBoundedConversation,
    private readonly desktopClient: SourceCodexDesktopMessageClient = new SourceCodexDesktopIpcClient(),
  ) {}

  async listTasks(query?: string): Promise<SourceCodexTask[]> {
    const result = await this.client.call<unknown>("thread/list", {
      archived: false,
      limit: 50,
      sortDirection: "desc",
      sortKey: "updated_at",
    });
    const normalized = extractThreadList(result)
      .map(toTask)
      .filter((task): task is SourceCodexTask => Boolean(task));
    const repositories = await this.resolveTaskRepositories(normalized);
    const currentRepository = await this.repositoryResolver(resolve(this.defaultCwd)).catch(() => undefined);
    const enriched = normalized.map((task) => {
      const repository = task.cwd ? repositories.get(resolve(task.cwd)) : undefined;
      return {
        ...task,
        currentProject: Boolean(repository && currentRepository && repository.path === currentRepository.path),
        repositoryLabel: repository?.label,
        repositoryPath: repository?.path,
        writable: this.connectedThreadIds.has(task.threadId),
      };
    });
    const search = query?.trim().toLocaleLowerCase();
    return enriched
      .filter((task) => !search || (
        `${task.title} ${task.cwd ?? ""} ${task.repositoryLabel ?? ""} ${task.repositoryPath ?? ""}`
          .toLocaleLowerCase()
          .includes(search)
      ))
      .sort(compareTasks)
      .slice(0, 50);
  }

  async inspectTask(threadId: string): Promise<SourceCodexTask> {
    assertThreadId(threadId);
    let result: unknown;
    try {
      result = await this.client.call<unknown>("thread/read", {
        includeTurns: false,
        threadId,
      });
    } catch (cause) {
      const connectedTask = this.connectedTasks.get(threadId);
      if (connectedTask && isNewThreadInitializationRace(cause)) return connectedTask;
      if (isUnavailableTask(cause)) {
        this.disconnectTask(threadId);
        throw unavailableTaskError();
      }
      throw cause;
    }
    const task = toTask(extractThread(result));
    if (!task) throw new SourceCodexAppServerError("The selected Codex task was not found.", 404);
    const inspected = { ...task, writable: this.connectedThreadIds.has(task.threadId) };
    if (inspected.writable) this.connectedTasks.set(inspected.threadId, inspected);
    return inspected;
  }

  async connectTask(threadId: string): Promise<SourceCodexTask> {
    const task = await this.inspectTask(threadId);
    const connectedTask = { ...task, writable: true };
    this.connectedThreadIds.add(threadId);
    this.connectedTasks.set(threadId, connectedTask);
    return connectedTask;
  }

  async createTask(cwd?: string): Promise<SourceCodexTask> {
    const requestedCwd = cwd?.trim() ? resolve(cwd) : this.defaultCwd;
    const result = await this.client.call<unknown>("thread/start", {
      approvalPolicy: "on-request",
      cwd: requestedCwd,
      ephemeral: false,
      sandbox: "workspace-write",
    });
    const task = toTask(extractThread(result));
    if (!task) throw new SourceCodexAppServerError("Codex did not return the new task.", 502);
    this.connectedThreadIds.add(task.threadId);
    this.createdThreadIds.add(task.threadId);
    const connectedTask = { ...task, writable: true };
    this.connectedTasks.set(task.threadId, connectedTask);
    return connectedTask;
  }

  async sendMessage(
    threadId: string,
    message: string,
    localImagePaths: readonly string[] = [],
  ): Promise<{ accepted: true }> {
    assertThreadId(threadId);
    const prompt = message.trim();
    if (!prompt) throw new SourceCodexAppServerError("The message cannot be empty.", 400);
    if (prompt.length > 32_000) throw new SourceCodexAppServerError("The message is too long.", 413);
    const images = await validateSourceCodexImagePaths(localImagePaths);

    if (!this.connectedThreadIds.has(threadId)) {
      throw new SourceCodexAppServerError(
        "Choose this task in Design Space before sending feedback to it.",
        409,
      );
    }

    const connectedTask = this.connectedTasks.get(threadId);
    if (!this.createdThreadIds.has(threadId) && connectedTask) {
      const desktopInput = {
        cwd: connectedTask.cwd ?? this.defaultCwd,
        localImagePaths: images,
        operationId: randomUUID(),
        prompt,
        threadId,
      };
      try {
        if (connectedTask.status === "active") {
          await this.desktopClient.steerTurn(desktopInput);
        } else {
          await this.desktopClient.startTurn(desktopInput);
        }
        return { accepted: true };
      } catch (cause) {
        if (isUnavailableDesktopTask(cause)) {
          this.disconnectTask(threadId);
          throw unavailableTaskError();
        }
        throw cause;
      }
    }

    const params = {
        clientUserMessageId: randomUUID(),
        input: [
          { text: prompt, type: "text" },
          ...images.map((path) => ({ path, type: "localImage" as const })),
        ],
        threadId,
      };
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.client.call("turn/start", params);
        break;
      } catch (cause) {
        if (isUnavailableTask(cause)) {
          this.disconnectTask(threadId);
          throw unavailableTaskError();
        }
        const delay = newThreadRetryDelays[attempt];
        if (delay === undefined || !isNewThreadInitializationRace(cause)) throw cause;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
        if (await this.hasPersistedPrompt(threadId, prompt)) return { accepted: true };
      }
    }
    return { accepted: true };
  }

  async readConversation(threadId: string): Promise<SourceCodexMessage[]> {
    assertThreadId(threadId);
    let result: unknown;
    try {
      result = await this.client.call<unknown>("thread/read", {
        includeTurns: false,
        threadId,
      });
    } catch (cause) {
      if (this.connectedThreadIds.has(threadId) && isNewThreadInitializationRace(cause)) return [];
      if (isUnavailableTask(cause)) {
        this.disconnectTask(threadId);
        throw unavailableTaskError();
      }
      throw cause;
    }
    const thread = extractThread(result);
    if (!thread) throw new SourceCodexAppServerError("The selected Codex task was not found.", 404);
    const path = typeof thread.path === "string" ? thread.path : undefined;
    if (!path) return [];
    return this.historyReader(path, threadId);
  }

  close(): Promise<void> {
    return this.client.close();
  }

  private async resolveTaskRepositories(tasks: SourceCodexTask[]): Promise<Map<string, RepositoryEvidence | undefined>> {
    const folders = [...new Set(tasks.flatMap((task) => task.cwd ? [resolve(task.cwd)] : []))];
    const entries = await Promise.all(folders.map(async (cwd) => (
      [cwd, await this.repositoryResolver(cwd).catch(() => undefined)] as const
    )));
    return new Map(entries);
  }

  private async hasPersistedPrompt(threadId: string, prompt: string): Promise<boolean> {
    try {
      const result = await this.client.call<unknown>("thread/read", {
        includeTurns: false,
        threadId,
      });
      const thread = extractThread(result);
      const path = thread && typeof thread.path === "string" ? thread.path : undefined;
      if (!path) return false;
      const messages = await this.historyReader(path, threadId);
      return messages.some((message) => message.role === "user" && message.text === prompt);
    } catch {
      return false;
    }
  }

  private disconnectTask(threadId: string): void {
    this.connectedThreadIds.delete(threadId);
    this.connectedTasks.delete(threadId);
  }
}

function isNewThreadInitializationRace(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /thread-store internal error|session metadata .* is empty/i.test(message);
}

function isUnavailableTask(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /thread not found|selected Codex task was not found/i.test(message);
}

function isUnavailableDesktopTask(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /owning Codex task is not available/i.test(message);
}

function unavailableTaskError(): SourceCodexAppServerError {
  return new SourceCodexAppServerError(
    "The selected Codex task is no longer available. Choose another task to reconnect.",
    410,
  );
}

async function resolveRepository(cwd: string): Promise<RepositoryEvidence | undefined> {
  const { stdout } = await execFileAsync("git", [
    "-C",
    cwd,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  const commonDirectory = stdout.trim();
  if (!commonDirectory) return undefined;
  const repositoryPath = commonDirectory.endsWith(`${sep}.git`)
    ? dirname(commonDirectory)
    : dirname(commonDirectory);
  return {
    label: basename(repositoryPath),
    path: repositoryPath,
  };
}

export async function readBoundedConversation(path: string, threadId: string): Promise<SourceCodexMessage[]> {
  const sessionsRoot = await realpath(resolve(homedir(), ".codex", "sessions"));
  const resolvedPath = await realpath(path);
  const distance = relative(sessionsRoot, resolvedPath);
  if (
    !distance
    || distance.startsWith(`..${sep}`)
    || distance === ".."
    || resolve(sessionsRoot, distance) !== resolvedPath
    || !basename(resolvedPath).endsWith(`-${threadId}.jsonl`)
  ) {
    throw new SourceCodexAppServerError("The Codex task history path is not trusted.", 403);
  }
  const evidence = await stat(resolvedPath);
  if (!evidence.isFile()) throw new SourceCodexAppServerError("The Codex task history is unavailable.", 404);
  const cached = conversationCache.get(resolvedPath);
  if (cached?.size === evidence.size) return [...cached.messages];

  const handle = await open(resolvedPath, "r");
  let messages: SourceCodexMessage[];
  try {
    messages = await readRecentConversationMessages(handle, evidence.size);
  } finally {
    await handle.close();
  }
  conversationCache.set(resolvedPath, { messages, size: evidence.size });
  return [...messages];
}

async function readRecentConversationMessages(
  handle: Awaited<ReturnType<typeof open>>,
  fileSize: number,
): Promise<SourceCodexMessage[]> {
  const newestMessages: SourceCodexMessage[] = [];
  let offset = fileSize;
  let scannedBytes = 0;
  let lineSuffix: Buffer = Buffer.alloc(0);
  let discardingOversizedLine = false;

  while (offset > 0 && scannedBytes < maximumHistoryScanBytes && newestMessages.length < maximumHistoryMessages) {
    const length = Math.min(historyChunkBytes, offset, maximumHistoryScanBytes - scannedBytes);
    offset -= length;
    scannedBytes += length;
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    const chunk = bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
    let segmentEnd = chunk.length;

    for (let index = chunk.length - 1; index >= 0; index -= 1) {
      if (chunk[index] !== 10) continue;
      const segment = chunk.subarray(index + 1, segmentEnd);
      if (!discardingOversizedLine) {
        const line = joinBoundedLine(segment, lineSuffix);
        if (line) pushConversationMessage(line, newestMessages);
      }
      if (newestMessages.length >= maximumHistoryMessages) break;
      lineSuffix = Buffer.alloc(0);
      discardingOversizedLine = false;
      segmentEnd = index;
    }

    if (newestMessages.length >= maximumHistoryMessages) break;
    const prefix = chunk.subarray(0, segmentEnd);
    if (!discardingOversizedLine) {
      const nextSuffix = joinBoundedLine(prefix, lineSuffix);
      if (nextSuffix) lineSuffix = nextSuffix;
      else {
        lineSuffix = Buffer.alloc(0);
        discardingOversizedLine = true;
      }
    }
  }

  if (offset === 0 && !discardingOversizedLine && lineSuffix.length) {
    pushConversationMessage(lineSuffix, newestMessages);
  }
  return newestMessages.reverse();
}

function joinBoundedLine(prefix: Buffer, suffix: Buffer): Buffer | undefined {
  if (prefix.length + suffix.length > maximumHistoryLineBytes) return undefined;
  if (!prefix.length) return suffix;
  if (!suffix.length) return prefix;
  return Buffer.concat([prefix, suffix], prefix.length + suffix.length);
}

function pushConversationMessage(line: Buffer, messages: SourceCodexMessage[]): void {
  if (!line.length) return;
  const text = line.toString("utf8").trim();
  if (!text || !text.includes('"response_item"') || !text.includes('"message"')) return;
  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    return;
  }
  const message = extractConversationMessage(record);
  if (message) messages.push(message);
}

function extractConversationMessage(value: unknown): SourceCodexMessage | undefined {
  if (!isRecord(value) || value.type !== "response_item" || !isRecord(value.payload)) return undefined;
  const payload = value.payload;
  if (payload.type !== "message" || (payload.role !== "user" && payload.role !== "assistant")) return undefined;
  if (!Array.isArray(payload.content)) return undefined;
  const text = payload.content
    .filter(isRecord)
    .filter((content) => content.type === "input_text" || content.type === "output_text")
    .map((content) => typeof content.text === "string" ? content.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
  const visibleText = sanitizeSourceCodexConversationText(text);
  if (!visibleText) return undefined;
  return {
    role: payload.role,
    text: visibleText.slice(0, maximumMessageCharacters),
  };
}

export function sanitizeSourceCodexConversationText(text: string): string {
  if (
    text.trimStart().startsWith("<recommended_plugins>")
    && text.includes("# AGENTS.md instructions")
  ) {
    return "";
  }

  return text
    .replace(
      /^# Files mentioned by the user:\s*[\s\S]*?^## My request for Codex:\s*/im,
      "",
    )
    .replace(/^## My request for Codex:\s*/im, "")
    .replace(/<in-app-browser-context\b[^>]*>[\s\S]*?<\/in-app-browser-context>/gi, "")
    .replace(/<codex_internal_context\b[^>]*>[\s\S]*?<\/codex_internal_context>/gi, "")
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, "")
    .replace(/<permissions instructions>[\s\S]*?<\/permissions instructions>/gi, "")
    .replace(/<collaboration_mode>[\s\S]*?<\/collaboration_mode>/gi, "")
    .replace(/<apps_instructions>[\s\S]*?<\/apps_instructions>/gi, "")
    .replace(/<plugins_instructions>[\s\S]*?<\/plugins_instructions>/gi, "")
    .replace(/<skills_instructions>[\s\S]*?<\/skills_instructions>/gi, "")
    .replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/gi, "")
    .replace(/<\/?image\b[^>]*>/gi, "")
    .trim();
}

function compareTasks(left: SourceCodexTask, right: SourceCodexTask): number {
  if (left.currentProject !== right.currentProject) return left.currentProject ? -1 : 1;
  const repository = (left.repositoryLabel ?? left.repositoryPath ?? "\uffff")
    .localeCompare(right.repositoryLabel ?? right.repositoryPath ?? "\uffff");
  if (repository) return repository;
  return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
}

function assertThreadId(threadId: string): void {
  if (!threadPattern.test(threadId)) {
    throw new SourceCodexAppServerError("The Codex task id is invalid.", 400);
  }
}

function extractThreadList(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  const candidate = value.data ?? value.threads ?? value.items;
  return Array.isArray(candidate) ? candidate.filter(isRecord) : [];
}

function extractThread(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value.thread ?? value.data ?? value;
  return isRecord(candidate) ? candidate : undefined;
}

function toTask(thread: UnknownRecord | undefined): SourceCodexTask | undefined {
  if (!thread || typeof thread.id !== "string" || !threadPattern.test(thread.id)) return undefined;
  const title = firstString(thread.name, thread.title) ?? previewTitle(thread.preview) ?? "Untitled Codex task";
  const cwd = typeof thread.cwd === "string" ? thread.cwd : undefined;
  const updatedAt = typeof thread.updatedAt === "number"
    ? thread.updatedAt
    : typeof thread.updated_at === "number"
      ? thread.updated_at
      : undefined;
  return {
    cwd,
    status: taskStatus(thread.status),
    threadId: thread.id,
    title: title.trim().slice(0, 160),
    updatedAt,
    writable: false,
  };
}

function taskStatus(value: unknown): SourceCodexTask["status"] {
  if (typeof value === "string") {
    if (value === "active") return "active";
    if (value === "idle") return "idle";
    if (value === "notLoaded" || value === "not_loaded") return "not-loaded";
  }
  if (isRecord(value)) {
    return taskStatus(value.type ?? value.status);
  }
  return "unknown";
}

function previewTitle(value: unknown): string | undefined {
  if (typeof value === "string") return value.split(/\r?\n/, 1)[0]?.trim();
  if (!Array.isArray(value)) return undefined;
  return value.find((entry): entry is string => typeof entry === "string")?.split(/\r?\n/, 1)[0]?.trim();
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
