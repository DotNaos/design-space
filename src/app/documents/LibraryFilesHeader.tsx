import { Button, Popover, SearchField } from "@heroui/react";
import { Check, ChevronDown, GitBranch, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  LibraryDevelopmentProjectStatus,
  LibraryDevelopmentWorktree,
} from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { LibraryBranchReloadDialog } from "../source/LibraryBranchReloadDialog";

export function LibraryFilesHeader(props: { fileCount: number }) {
  const [status, setStatus] = useState<LibraryDevelopmentProjectStatus>();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyBranch, setBusyBranch] = useState<string>();
  const [pendingChoice, setPendingChoice] = useState<BranchChoice>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    void runLocalOperation<LibraryDevelopmentProjectStatus>({ type: "get-library-development" })
      .then((next) => {
        if (current) setStatus(next);
      })
      .catch((cause) => {
        if (current) setError(operationMessage(cause));
      });
    return () => { current = false; };
  }, []);

  const active = activeWorktree(status);
  const branches = useMemo(() => branchChoices(status), [status]);
  const visibleBranches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return branches.filter((choice) => !normalized || choice.name.toLocaleLowerCase().includes(normalized));
  }, [branches, query]);
  const path = active?.path ?? status?.checkoutPath;

  function requestActivation(choice: BranchChoice) {
    if (choice.worktree?.active || busyBranch) {
      setOpen(false);
      return;
    }
    setError(undefined);
    setPendingChoice(choice);
    setOpen(false);
  }

  async function activate() {
    if (!pendingChoice || busyBranch) return;
    setBusyBranch(pendingChoice.name);
    setError(undefined);
    try {
      const next = await runLocalOperation<LibraryDevelopmentProjectStatus>({
        type: "activate-library-development-branch",
        branch: pendingChoice.name,
      });
      setStatus(next);
      setPendingChoice(undefined);
    } catch (cause) {
      setError(operationMessage(cause));
    } finally {
      setBusyBranch(undefined);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-xs font-medium text-zinc-300">Library files</h2>
          <span className="shrink-0 text-[9px] text-zinc-600">{props.fileCount}</span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[9px] text-zinc-600" title={path}>
          {path ?? "Resolving project path…"}
        </p>
      </div>

      <Popover isOpen={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}>
        <Button
          aria-label="Library branch and worktree"
          className="h-7 max-w-40 min-w-0 gap-1.5 rounded-full bg-white/[0.055] px-2.5 text-[9px] text-zinc-300 hover:bg-white/[0.09]"
          isDisabled={!status?.cloned}
          size="sm"
          variant="ghost"
        >
          <GitBranch aria-hidden="true" className="size-3 shrink-0 text-violet-300" />
          <span className="min-w-0 truncate">{active?.branch ?? "Choose worktree"}</span>
          <ChevronDown aria-hidden="true" className="size-2.5 shrink-0 text-zinc-600" />
        </Button>
        <Popover.Content
          className="w-[min(21rem,calc(100vw-1rem))] rounded-xl bg-[#1b1c20] p-0 text-zinc-200 shadow-2xl"
          placement="bottom end"
        >
          <Popover.Dialog className="outline-none">
            <div className="p-2.5">
              <Popover.Heading className="px-1 text-xs font-semibold text-zinc-100">Branches and worktrees</Popover.Heading>
              <SearchField
                aria-label="Search library branches"
                className="mt-2"
                fullWidth
                value={query}
                onChange={setQuery}
              >
                <SearchField.Group className="flex h-8 items-center gap-2 rounded-full bg-black/20 px-2.5 text-zinc-500 focus-within:ring-1 focus-within:ring-violet-400/50">
                  <SearchField.SearchIcon className="size-3" />
                  <SearchField.Input
                    autoFocus
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600"
                    placeholder="Search branches"
                  />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            </div>
            <div className="max-h-72 overflow-y-auto px-1.5 pb-1.5" role="listbox" aria-label="Library branches">
              {visibleBranches.map((choice) => {
                return (
                  <div
                    key={choice.name}
                    aria-label={choice.name}
                    aria-selected={choice.worktree?.active ?? false}
                    className={`flex min-h-9 items-center gap-2 rounded-lg px-2 ${choice.worktree?.active ? "bg-violet-400/15" : "hover:bg-white/[0.045]"}`}
                    role="option"
                    title={choice.worktree?.path ?? choice.name}
                  >
                    <GitBranch aria-hidden="true" className={`size-3 shrink-0 ${choice.worktree?.active ? "text-violet-300" : "text-zinc-600"}`} />
                    <Button
                      className="h-auto min-w-0 flex-1 justify-start truncate rounded-none bg-transparent p-0 text-left text-[10px] text-zinc-300 outline-none disabled:cursor-default"
                      isDisabled={choice.worktree?.active || Boolean(busyBranch)}
                      variant="ghost"
                      onPress={() => requestActivation(choice)}
                    >
                      {choice.name}
                    </Button>
                    {choice.worktree?.active
                      ? <Check aria-label="Current worktree" className="size-3 shrink-0 text-violet-300" />
                      : <span className="shrink-0 text-[8px] text-zinc-600">{choice.worktree ? "Worktree" : "Creates worktree"}</span>}
                  </div>
                );
              })}
              {!visibleBranches.length ? (
                <div className="px-3 py-7 text-center">
                  <SearchX aria-hidden="true" className="mx-auto size-4 text-zinc-700" />
                  <p className="mt-2 text-[9px] text-zinc-600">No matching branches</p>
                </div>
              ) : null}
            </div>
            {error ? <p className="px-3 pb-2.5 text-[9px] text-rose-300">{error}</p> : null}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <LibraryBranchReloadDialog
        branch={pendingChoice?.name}
        busy={Boolean(busyBranch)}
        createsWorktree={!pendingChoice?.worktree}
        error={error}
        onCancel={() => {
          setPendingChoice(undefined);
          setError(undefined);
        }}
        onConfirm={() => void activate()}
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
  const branches = status.branches?.length
    ? status.branches
    : status.worktrees.map((worktree) => worktree.branch);
  const byBranch = new Map(status.worktrees.map((worktree) => [worktree.branch, worktree]));
  const result = branches.map((name) => ({ name, worktree: byBranch.get(name) }));
  for (const worktree of status.worktrees) {
    if (!branches.includes(worktree.branch)) result.push({ name: worktree.branch, worktree });
  }
  return result.sort((left, right) => {
    if (left.worktree?.active) return -1;
    if (right.worktree?.active) return 1;
    if (left.name === "main") return -1;
    if (right.name === "main") return 1;
    return left.name.localeCompare(right.name, "en");
  });
}

function activeWorktree(status?: LibraryDevelopmentProjectStatus): LibraryDevelopmentWorktree | undefined {
  if (!status) return undefined;
  return status.worktrees.find((worktree) => worktree.active)
    ?? status.worktrees.find((worktree) => worktree.id === status.activeWorktreeId)
    ?? status.worktrees.find((worktree) => worktree.path === status.checkoutPath);
}

function operationMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The library worktrees could not be loaded.";
}
