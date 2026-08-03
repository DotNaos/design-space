import { Button, Input, ListBox, Select } from "@heroui/react";
import { Download, GitBranch, LoaderCircle, Play, Search, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LibraryDevelopmentProjectStatus } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";

interface LibraryDevelopmentSourceControlProps {
  onModeChange: (mode: "development" | "release") => void;
}

export function LibraryDevelopmentSourceControl(props: LibraryDevelopmentSourceControlProps) {
  const [status, setStatus] = useState<LibraryDevelopmentProjectStatus>();
  const [selection, setSelection] = useState<string>();
  const [worktreeQuery, setWorktreeQuery] = useState("");
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
  const visibleWorktrees = useMemo(() => {
    const query = worktreeQuery.trim().toLocaleLowerCase();
    return status?.worktrees.filter((worktree) => !query || worktree.branch.toLocaleLowerCase().includes(query)) ?? [];
  }, [status?.worktrees, worktreeQuery]);

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
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_2.25rem] gap-1.5">
      <Select
        aria-label="Development library worktree"
        className="min-w-0"
        isDisabled={Boolean(busy) || status.state === "running"}
        selectedKey={selection}
        onOpenChange={(open) => {
          if (!open) setWorktreeQuery("");
        }}
        onSelectionChange={(key) => {
          setSelection(String(key));
          setWorktreeQuery("");
        }}
      >
        <Select.Trigger className="flex h-9 min-w-0 items-center gap-2 rounded-lg bg-black/25 px-2.5 text-[10px] text-zinc-300 outline-none ring-1 ring-inset ring-white/[0.07] data-[focus-visible]:ring-sky-400/30">
          <GitBranch className="size-3 shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-left font-medium">{selected?.branch ?? "Choose branch"}</span>
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover className="min-w-64 rounded-lg bg-[#18191c] p-1 shadow-2xl" placement="bottom">
          <div className="mb-1 flex h-8 items-center gap-2 rounded-md bg-black/25 px-2 ring-1 ring-inset ring-white/[0.07] focus-within:ring-sky-400/30">
            <Search aria-hidden="true" className="size-3 shrink-0 text-zinc-600" />
            <Input
              aria-label="Search branches"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600"
              placeholder="Search branches"
              value={worktreeQuery}
              onChange={(event) => setWorktreeQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation();
              }}
            />
          </div>
          <ListBox items={visibleWorktrees}>
            {(worktree) => (
              <ListBox.Item
                className="flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 text-[10px] text-zinc-300 outline-none data-[disabled]:opacity-40 data-[focused]:bg-white/10 data-[selected]:text-sky-300"
                id={worktree.id}
                isDisabled={!worktree.packageReady}
                textValue={worktree.branch}
              >
                <GitBranch className="size-3 shrink-0 text-zinc-600" />
                <span className="min-w-0 flex-1 truncate">{worktree.branch}</span>
                {!worktree.packageReady ? <span className="shrink-0 text-[8px] text-amber-300/70">Package missing</span> : null}
                <ListBox.ItemIndicator className="ml-auto size-3 shrink-0" />
              </ListBox.Item>
            )}
          </ListBox>
          {!visibleWorktrees.length ? (
            <p className="px-2 py-3 text-center text-[9px] text-zinc-600">No matching branches</p>
          ) : null}
        </Select.Popover>
      </Select>
      <Button
        aria-label={status.state === "running" ? "Stop development source" : "Start development source"}
        className={`size-9 rounded-lg ${
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
