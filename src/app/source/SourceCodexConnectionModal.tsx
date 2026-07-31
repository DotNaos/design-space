import { Button, Input, Modal } from "@heroui/react";
import {
  Check,
  CircleDot,
  Folder,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  connectSourceCodexTask,
  createSourceCodexTask,
  listSourceCodexTasks,
  type SourceCodexTask,
} from "./source-codex-feedback-client";

type ConnectionMode = "existing" | "new";

export function SourceCodexConnectionModal(props: {
  current?: SourceCodexTask;
  preferredThreadId?: string;
  notice?: string;
  open: boolean;
  onClose: () => void;
  onConnected: (task: SourceCodexTask) => void;
}) {
  const [mode, setMode] = useState<ConnectionMode>("existing");
  const [tasks, setTasks] = useState<SourceCodexTask[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!props.open) return;
    setMode("existing");
    setQuery("");
    setSelectedId(props.current?.threadId ?? props.preferredThreadId ?? "");
    setError(undefined);
    void loadTasks();
  }, [props.open, props.current?.threadId, props.preferredThreadId]);

  async function loadTasks() {
    setLoading(true);
    setError(undefined);
    try {
      const next = await listSourceCodexTasks();
      setTasks(next);
      const preferredThreadId = props.current?.threadId ?? props.preferredThreadId;
      const preferredTask = preferredThreadId
        ? next.find((task) => task.threadId === preferredThreadId)
        : undefined;
      setSelectedId((current) => (
        next.some((task) => task.threadId === current)
          ? current
          : preferredTask?.threadId ?? next[0]?.threadId ?? ""
      ));
      if (props.notice && preferredTask) {
        const task = preferredTask.writable
          ? preferredTask
          : await connectSourceCodexTask(preferredTask.threadId);
        props.onConnected(task);
        props.onClose();
      }
    } catch (cause: unknown) {
      setError(messageFrom(cause, "Codex tasks could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const task = await connectSourceCodexTask(selectedId);
      props.onConnected(task);
      props.onClose();
    } catch (cause: unknown) {
      setError(messageFrom(cause, "The selected Codex task could not be connected."));
    } finally {
      setSubmitting(false);
    }
  }

  async function create() {
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const task = await createSourceCodexTask();
      props.onConnected(task);
      props.onClose();
    } catch (cause: unknown) {
      setError(messageFrom(cause, "A new Codex task could not be created."));
    } finally {
      setSubmitting(false);
    }
  }

  const visibleTasks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return tasks;
    return tasks.filter((task) => (
      `${task.title} ${task.cwd ?? ""} ${task.repositoryLabel ?? ""} ${task.repositoryPath ?? ""}`
        .toLocaleLowerCase()
        .includes(search)
    ));
  }, [query, tasks]);
  const taskGroups = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);

  return (
    <Modal.Backdrop
      isOpen={props.open}
      onOpenChange={(open) => {
        if (!open && !submitting) props.onClose();
      }}
      variant="blur"
    >
      <Modal.Container className="p-3 sm:p-6" placement="center" size="md">
        <Modal.Dialog
          aria-label="Connect Codex task"
          className="max-h-[min(720px,88dvh)] w-full overflow-hidden rounded-xl border border-white/10 bg-[#17181b] text-zinc-200 shadow-2xl"
        >
          <Modal.Header className="border-b border-white/10 px-4 py-3">
            <div className="flex w-full items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-sky-500/10 text-sky-300">
                <CircleDot aria-hidden="true" size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <Modal.Heading className="text-sm font-semibold text-zinc-100">
                  Connect Codex
                </Modal.Heading>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Choose the task that should receive canvas feedback.
                </p>
              </div>
              <Button
                isIconOnly
                aria-label="Close Codex task picker"
                className="size-9 min-w-9"
                isDisabled={submitting}
                size="sm"
                variant="ghost"
                onPress={props.onClose}
              >
                <X aria-hidden="true" size={15} />
              </Button>
            </div>
          </Modal.Header>

          <Modal.Body className="min-h-0 overflow-hidden p-0">
            {props.notice ? (
              <p
                role="status"
                className="border-b border-amber-300/15 bg-amber-300/[0.06] px-4 py-2 text-[10px] leading-4 text-amber-100/90"
              >
                {props.notice}
              </p>
            ) : null}
            <div className="grid grid-cols-2 border-b border-white/10 p-2">
              <Button
                className={`h-9 rounded-md text-xs ${mode === "existing" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}
                variant="ghost"
                onPress={() => setMode("existing")}
              >
                Existing task
              </Button>
              <Button
                className={`h-9 rounded-md text-xs ${mode === "new" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}
                variant="ghost"
                onPress={() => setMode("new")}
              >
                New task
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex gap-2 border-b border-white/10 p-3">
                  <div className="relative min-w-0 flex-1">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                    <Input
                      aria-label="Search Codex tasks"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-400/40"
                      placeholder="Search tasks or project paths"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <Button
                    isIconOnly
                    aria-label="Refresh Codex tasks"
                    className="size-10 min-w-10 rounded-lg border border-white/10 text-zinc-400"
                    isDisabled={loading}
                    variant="ghost"
                    onPress={() => void loadTasks()}
                  >
                    <RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} size={14} />
                  </Button>
                </div>

                <div className="min-h-64 flex-1 overflow-y-auto p-2">
                  {loading && !tasks.length ? (
                    <EmptyState icon={<LoaderCircle className="animate-spin" size={18} />} label="Loading Codex tasks…" />
                  ) : taskGroups.length ? (
                    <div className="space-y-3">
                      {taskGroups.map((group) => (
                        <section key={group.key} aria-label={group.label}>
                          <div className="flex items-center gap-2 px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                            <Folder aria-hidden="true" size={10} />
                            <span className="min-w-0 truncate">{group.label}</span>
                            <span className="ml-auto tabular-nums text-zinc-700">{group.tasks.length}</span>
                          </div>
                          <div className="space-y-0.5">
                            {group.tasks.map((task) => {
                              const selected = task.threadId === selectedId;
                              return (
                                <Button
                                  key={task.threadId}
                                  fullWidth
                                  className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                                    selected ? "bg-sky-500/12" : "hover:bg-white/[0.04]"
                                  }`}
                                  variant="ghost"
                                  onPress={() => setSelectedId(task.threadId)}
                                >
                                  <span className={`size-2 shrink-0 rounded-full ${statusColor(task.status)}`} />
                                  <span className="min-w-0 flex-1">
                                    <span className={`block truncate text-xs font-medium ${selected ? "text-sky-200" : "text-zinc-200"}`}>
                                      {task.title}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[9px] text-zinc-600">
                                      {relativeTaskFolder(task)} · {task.writable ? "Connected here" : "Ready to connect"}
                                    </span>
                                  </span>
                                  {selected ? <Check aria-hidden="true" className="shrink-0 text-sky-300" size={14} /> : null}
                                </Button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={<Search size={18} />} label="No matching Codex tasks." />
                  )}
                </div>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center px-8 py-12 text-center">
                <div>
                  <span className="mx-auto grid size-10 place-items-center rounded-lg bg-white/5 text-zinc-400">
                    <Plus aria-hidden="true" size={18} />
                  </span>
                  <h3 className="mt-3 text-sm font-medium text-zinc-100">Start a new task</h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                    Creates an empty Codex task for this Design Space project. Your first composer message becomes its instructions.
                  </p>
                </div>
              </div>
            )}

            {error ? (
              <p role="alert" className="border-t border-red-400/15 bg-red-500/8 px-4 py-2 text-[10px] leading-4 text-red-300">
                {error}
              </p>
            ) : null}
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-2 border-t border-white/10 px-3 py-3">
            <Button className="h-9 px-4 text-xs" isDisabled={submitting} variant="secondary" onPress={props.onClose}>
              Cancel
            </Button>
            {mode === "existing" ? (
              <Button className="h-9 px-4 text-xs" isDisabled={!selectedId || submitting} onPress={() => void connect()}>
                {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={13} /> : null}
                Connect task
              </Button>
            ) : (
              <Button className="h-9 px-4 text-xs" isDisabled={submitting} onPress={() => void create()}>
                {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={13} /> : <Plus aria-hidden="true" size={13} />}
                Create and connect
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function groupTasks(tasks: SourceCodexTask[]): Array<{ key: string; label: string; tasks: SourceCodexTask[] }> {
  const groups = new Map<string, { key: string; label: string; tasks: SourceCodexTask[] }>();
  for (const task of tasks) {
    const key = task.repositoryPath ?? "other-folders";
    const label = task.currentProject
      ? `Current project · ${task.repositoryLabel ?? "Repository"}`
      : task.repositoryLabel ?? "Other folders";
    const group = groups.get(key) ?? { key, label, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function relativeTaskFolder(task: SourceCodexTask): string {
  if (!task.cwd) return "No project folder";
  if (!task.repositoryPath || !task.cwd.startsWith(task.repositoryPath)) return task.cwd;
  const relative = task.cwd.slice(task.repositoryPath.length).replace(/^\/+/, "");
  return relative || "main checkout";
}

function EmptyState(props: { icon: ReactNode; label: string }) {
  return (
    <div className="grid min-h-48 place-items-center text-center text-zinc-600">
      <div>
        <span className="mx-auto grid size-8 place-items-center">{props.icon}</span>
        <p className="mt-1 text-xs">{props.label}</p>
      </div>
    </div>
  );
}

function statusColor(status: SourceCodexTask["status"]): string {
  if (status === "active") return "bg-emerald-400";
  if (status === "idle") return "bg-sky-400";
  return "bg-zinc-600";
}

function messageFrom(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
