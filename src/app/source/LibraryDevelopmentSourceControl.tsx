import { Button, Input, ListBox, Select } from "@heroui/react";
import { Download, GitBranch, LoaderCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LibraryDevelopmentProjectStatus, LibraryDevelopmentWorktree } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { LibraryBranchReloadDialog } from "./LibraryBranchReloadDialog";
import { OperationError } from "./OperationError";

interface LibraryDevelopmentSourceControlProps {
  onModeChange: (mode: "development" | "release") => void;
}

export function LibraryDevelopmentSourceControl(props: LibraryDevelopmentSourceControlProps) {
  const [status, setStatus] = useState<LibraryDevelopmentProjectStatus>();
  const [selection, setSelection] = useState<string>();
  const [pendingBranch, setPendingBranch] = useState<string>();
  const [worktreeQuery, setWorktreeQuery] = useState("");
  const [busy, setBusy] = useState<"clone" | "activate">();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const next = await runLocalOperation<LibraryDevelopmentProjectStatus>({
        type: "get-library-development",
      });
      setStatus(next);
      setSelection(activeWorktree(next)?.branch);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Library development is unavailable.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const branches = useMemo(() => branchChoices(status), [status]);
  const visibleWorktrees = useMemo(() => {
    const query = worktreeQuery.trim().toLocaleLowerCase();
    return branches.filter((choice) => !query || choice.name.toLocaleLowerCase().includes(query));
  }, [branches, worktreeQuery]);

  async function run(action: "clone" | "activate", branch = pendingBranch) {
    setBusy(action);
    setError(undefined);
    try {
      if (action === "clone") {
        const next = await runLocalOperation<LibraryDevelopmentProjectStatus>({
          type: "clone-library-development",
        });
        setStatus(next);
        setSelection(activeWorktree(next)?.branch);
      } else if (action === "activate" && branch) {
        try { localStorage.setItem("design-space.library-source", "development"); } catch { /* optional preference */ }
        props.onModeChange("development");
        const next = await runLocalOperation<LibraryDevelopmentProjectStatus>({
          type: "activate-library-development-branch",
          branch,
        });
        setStatus(next);
        setSelection(branch);
        setPendingBranch(undefined);
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
      <div className="mt-2 rounded-lg bg-white/[0.035] p-2">
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
    <div className="mt-2">
      <Select
        aria-label="Development library worktree"
        className="min-w-0"
        isDisabled={Boolean(busy)}
        selectedKey={selection}
        onOpenChange={(open) => {
          if (!open) setWorktreeQuery("");
        }}
        onSelectionChange={(key) => {
          const branch = String(key);
          setWorktreeQuery("");
          if (branch !== selection) {
            setError(undefined);
            setPendingBranch(branch);
          }
        }}
      >
        <Select.Trigger className="flex h-9 min-w-0 items-center gap-2 rounded-full bg-white/[0.055] px-3 text-[10px] text-zinc-300 outline-none transition-colors data-[focus-visible]:bg-white/[0.09]">
          <GitBranch className="size-3 shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-left font-medium">{selection ?? "Choose branch"}</span>
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover className="min-w-64 rounded-lg bg-[#1b1c20] p-1 shadow-2xl" placement="bottom">
          <div className="mb-1 flex h-8 items-center gap-2 rounded-md bg-white/[0.055] px-2 transition-colors focus-within:bg-white/[0.09]">
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
            {(choice) => (
              <ListBox.Item
                className="flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 text-[10px] text-zinc-300 outline-none data-[disabled]:opacity-40 data-[focused]:bg-white/10 data-[selected]:text-sky-300"
                id={choice.name}
                textValue={choice.name}
              >
                <GitBranch className="size-3 shrink-0 text-zinc-600" />
                <span className="min-w-0 flex-1 truncate">{choice.name}</span>
                {!choice.worktree ? <span className="shrink-0 text-[8px] text-zinc-600">Creates worktree</span> : null}
                <ListBox.ItemIndicator className="ml-auto size-3 shrink-0" />
              </ListBox.Item>
            )}
          </ListBox>
          {!visibleWorktrees.length ? (
            <p className="px-2 py-3 text-center text-[9px] text-zinc-600">No matching branches</p>
          ) : null}
        </Select.Popover>
      </Select>
      {error ? <OperationError message={error} /> : null}
      <LibraryBranchReloadDialog
        branch={pendingBranch}
        busy={busy === "activate"}
        createsWorktree={Boolean(pendingBranch && !branches.find((choice) => choice.name === pendingBranch)?.worktree)}
        error={error}
        onCancel={() => {
          setPendingBranch(undefined);
          setError(undefined);
        }}
        onConfirm={() => void run("activate")}
      />
    </div>
  );
}

interface BranchChoice {
  name: string;
  worktree?: LibraryDevelopmentWorktree;
}

function branchChoices(status?: LibraryDevelopmentProjectStatus): BranchChoice[] {
  if (!status) return [];
  const branches = status.branches?.length ? status.branches : status.worktrees.map((worktree) => worktree.branch);
  const byBranch = new Map(status.worktrees.map((worktree) => [worktree.branch, worktree]));
  return branches.map((name) => ({ name, worktree: byBranch.get(name) })).sort((left, right) => {
    if (left.worktree?.active) return -1;
    if (right.worktree?.active) return 1;
    if (left.name === "main") return -1;
    if (right.name === "main") return 1;
    return left.name.localeCompare(right.name, "en");
  });
}

function activeWorktree(status: LibraryDevelopmentProjectStatus): LibraryDevelopmentWorktree | undefined {
  return status.worktrees.find((worktree) => worktree.active)
    ?? status.worktrees.find((worktree) => worktree.id === status.activeWorktreeId);
}

function repositoryLabel(repository?: string): string {
  if (!repository) return "Development repository";
  return repository.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
}
