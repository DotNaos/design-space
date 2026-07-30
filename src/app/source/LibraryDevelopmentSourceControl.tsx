import { Button, ListBox, Select } from "@heroui/react";
import { Download, GitBranch, LoaderCircle, Play, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LibraryDevelopmentProjectStatus } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";

interface LibraryDevelopmentSourceControlProps {
  onModeChange: (mode: "development" | "release") => void;
}

export function LibraryDevelopmentSourceControl(props: LibraryDevelopmentSourceControlProps) {
  const [status, setStatus] = useState<LibraryDevelopmentProjectStatus>();
  const [selection, setSelection] = useState<string>();
  const [busy, setBusy] = useState<"clone" | "start" | "stop">();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const next = await runLocalOperation<LibraryDevelopmentProjectStatus>({
        type: "get-library-development",
      });
      setStatus(next);
      setSelection((current) => chooseWorktree(next, current));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Library development is unavailable.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => status?.worktrees.find((worktree) => worktree.id === selection),
    [selection, status?.worktrees],
  );

  async function run(action: "clone" | "start" | "stop") {
    setBusy(action);
    setError(undefined);
    try {
      if (action === "clone") {
        const next = await runLocalOperation<LibraryDevelopmentProjectStatus>({
          type: "clone-library-development",
        });
        setStatus(next);
        setSelection(chooseWorktree(next));
      } else if (action === "start" && selected) {
        try { localStorage.setItem("design-space.library-source", "development"); } catch { /* optional preference */ }
        props.onModeChange("development");
        setStatus(await runLocalOperation<LibraryDevelopmentProjectStatus>({
          type: "start-library-development",
          worktreeId: selected.id,
        }));
      } else if (action === "stop") {
        try { localStorage.setItem("design-space.library-source", "release"); } catch { /* optional preference */ }
        props.onModeChange("release");
        setStatus(await runLocalOperation<LibraryDevelopmentProjectStatus>({
          type: "stop-library-development",
        }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The library operation failed.");
    } finally {
      setBusy(undefined);
    }
  }

  if (!status?.configured && !error) return null;
  if (!status?.cloned) {
    return (
      <div className="mt-2 rounded-lg border border-white/10 bg-black/15 p-2">
        <p className="truncate text-[9px] text-zinc-600" title={status?.repository}>
          {repositoryLabel(status?.repository)}
        </p>
        <Button
          className="mt-2 h-8 w-full justify-center gap-1.5 rounded-md bg-white/[0.06] text-[10px] text-zinc-300"
          isDisabled={Boolean(busy)}
          size="sm"
          variant="ghost"
          onPress={() => void run("clone")}
        >
          {busy === "clone" ? <LoaderCircle className="animate-spin" size={12} /> : <Download size={12} />}
          Clone development source
        </Button>
        {error ? <OperationError message={error} /> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
      <Select
        aria-label="Development library worktree"
        className="min-w-0"
        isDisabled={Boolean(busy) || status.state === "running"}
        selectedKey={selection}
        onSelectionChange={(key) => setSelection(String(key))}
      >
        <Select.Trigger className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 text-[10px] text-zinc-300 outline-none data-[focus-visible]:border-sky-300/40">
          <GitBranch className="size-3 shrink-0 text-zinc-500" />
          <Select.Value className="min-w-0 flex-1 truncate text-left" />
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover className="min-w-64 rounded-lg border border-white/10 bg-[#18191c] p-1 shadow-2xl" placement="bottom">
          <ListBox items={status.worktrees}>
            {(worktree) => (
              <ListBox.Item
                className="flex min-h-10 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[disabled]:opacity-40 data-[focused]:bg-white/10 data-[selected]:text-sky-300"
                id={worktree.id}
                isDisabled={!worktree.packageReady}
                textValue={worktree.branch}
              >
                <span className="min-w-0">
                  <span className="block truncate">{worktree.branch}</span>
                  <span className="block truncate font-mono text-[9px] text-zinc-600">
                    {worktree.packageReady ? worktree.path : "UI package missing"}
                  </span>
                </span>
                <ListBox.ItemIndicator className="ml-auto size-3 shrink-0" />
              </ListBox.Item>
            )}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button
        aria-label={status.state === "running" ? "Stop development source" : "Start development source"}
        className={`size-8 rounded-md ${
          status.state === "running"
            ? "bg-rose-400/10 text-rose-300"
            : "bg-emerald-400/10 text-emerald-300"
        }`}
        isDisabled={Boolean(busy) || (status.state !== "running" && !selected?.packageReady)}
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={() => void run(status.state === "running" ? "stop" : "start")}
      >
        {busy
          ? <LoaderCircle className="animate-spin" size={12} />
          : status.state === "running" ? <Square size={11} /> : <Play size={12} />}
      </Button>
      {error ? <div className="col-span-2"><OperationError message={error} /></div> : null}
    </div>
  );
}

function chooseWorktree(
  status: LibraryDevelopmentProjectStatus,
  current?: string,
): string | undefined {
  if (current && status.worktrees.some((worktree) => worktree.id === current && worktree.packageReady)) {
    return current;
  }
  return status.activeWorktreeId
    ?? status.worktrees.find((worktree) => worktree.path === status.checkoutPath && worktree.packageReady)?.id
    ?? status.worktrees.find((worktree) => worktree.packageReady)?.id;
}

function repositoryLabel(repository?: string): string {
  if (!repository) return "Development repository";
  return repository.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
}

function OperationError(props: { message: string }) {
  return <p className="mt-1.5 text-[9px] leading-4 text-rose-300">{props.message}</p>;
}
