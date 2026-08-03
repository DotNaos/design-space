import { Button, Switch, ToggleButton, Tooltip } from "@heroui/react";
import { ChevronDown, Eye, EyeOff, FileBox, Layers3, ListCollapse, Plus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import type { ComponentTreeRow, SelectionTarget } from "../../../model";
import type { StrictUiViolation } from "../../../shared/strict-ui";
import { buildStrictUiSelectionMarkers, strictUiMarkerForTreeRow } from "../../strict-ui/strict-ui-markers";
import { annotateTreeRows, treeSelectionPath, visibleTreeRows } from "./component-tree-structure";
import { TreeRow } from "./TreeRow";

type ComponentTreeProps = {
  className?: string;
  embedded?: boolean;
  pageLabel: string;
  rows: readonly ComponentTreeRow[];
  selectedId: string;
  showInternals: boolean;
  insertMode?: boolean;
  prompt?: string;
  emptyMessage?: string;
  toggleLabel?: string;
  toggleHint?: string;
  strictUiViolations?: readonly StrictUiViolation[];
  onHover?: (selection: SelectionTarget | undefined) => void;
  onHoverInternals?: (componentInstanceId: string | undefined) => void;
  onContextMenuRequest?: (selection: SelectionTarget, position: { x: number; y: number }) => void;
  onInsert?: () => void;
  onSelect: (selection: SelectionTarget) => void;
  onCollapseAll?: () => void;
  onToggleInternals: (componentInstanceId?: string) => void;
};

export function ComponentTree(props: ComponentTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [collapsedBranches, setCollapsedBranches] = useState<ReadonlySet<string>>(() => new Set());
  const markers = buildStrictUiSelectionMarkers(props.strictUiViolations ?? []);
  const levelOffset = props.embedded ? 1 : 2;
  const annotatedRows = useMemo(() => annotateTreeRows(props.rows, props.selectedId), [props.rows, props.selectedId]);
  const selectedPath = useMemo(() => treeSelectionPath(annotatedRows, props.selectedId), [annotatedRows, props.selectedId]);
  const visibleRows = useMemo(() => visibleTreeRows(annotatedRows, collapsedBranches), [annotatedRows, collapsedBranches]);

  useEffect(() => {
    setCollapsedBranches((current) => {
      const next = new Set(current);
      for (const id of selectedPath) next.delete(id);
      return next.size === current.size ? current : next;
    });
  }, [selectedPath]);

  useLayoutEffect(() => {
    const selected = [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-design-space-selection-id]") ?? [])]
      .find((element) => element.dataset.designSpaceSelectionId === props.selectedId);
    selected?.scrollIntoView?.({ block: "nearest" });
  }, [props.selectedId, visibleRows]);

  const collapseAll = () => {
    const preserved = new Set(selectedPath);
    setCollapsedBranches(new Set(annotatedRows.flatMap((item) => (
      item.branchKey && !preserved.has(item.branchKey) ? [item.branchKey] : []
    ))));
    props.onCollapseAll?.();
  };
  const toggleBranch = (branchKey: string) => setCollapsedBranches((current) => {
    const next = new Set(current);
    if (next.has(branchKey)) next.delete(branchKey);
    else next.add(branchKey);
    return next;
  });
  return (
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col ${props.embedded ? "" : "border-r border-white/10 bg-[#141518]"}`}>
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-3">
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200">{props.embedded ? "Layers" : "Component tree"}</h2>
        {!props.embedded && <span className="max-w-20 truncate text-[10px] text-zinc-600">{props.pageLabel}</span>}
        {!props.emptyMessage && <Tooltip delay={350}>
          <Button
            isIconOnly
            aria-label="Collapse all tree branches"
            className="size-8 min-w-8 shrink-0 rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
            size="sm"
            variant="ghost"
            onPress={collapseAll}
          >
            <ListCollapse aria-hidden="true" size={14} />
          </Button>
          <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">Collapse all · keeps selection visible</Tooltip.Content>
        </Tooltip>}
        {props.onInsert && (
          <ToggleButton
            className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-medium transition-colors ${props.insertMode ? "bg-sky-500/20 text-sky-200" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"}`}
            isSelected={props.insertMode}
            size="sm"
            variant="ghost"
            onChange={props.onInsert}
          >
            {props.insertMode ? <X aria-hidden="true" size={12} /> : <Plus aria-hidden="true" size={12} />}
            {props.insertMode ? "Cancel" : "Insert"}
          </ToggleButton>
        )}
      </div>

      {props.prompt && <p className="border-b border-sky-400/20 bg-sky-500/10 px-3 py-2 text-[10px] leading-4 text-sky-200">{props.prompt}</p>}

      <div
        ref={treeRef}
        aria-label="Component tree"
        className="min-h-0 flex-1 overflow-y-auto py-2 text-xs outline-none"
        role="tree"
        tabIndex={0}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          const selected = event.currentTarget.querySelector<HTMLButtonElement>('button[role="treeitem"][aria-selected="true"]');
          (selected ?? event.currentTarget.querySelector<HTMLButtonElement>('button[role="treeitem"]'))?.focus();
        }}
        onKeyDown={navigateTree}
      >
        {!props.embedded && (
          <div aria-expanded="true" aria-level={1} className="flex h-11 items-center gap-2 px-3 text-zinc-400 lg:h-8" role="treeitem">
            <ChevronDown size={13} className="text-zinc-600" />
            <FileBox size={14} />
            <span className="truncate">{props.pageLabel}</span>
          </div>
        )}
        {visibleRows.map((item) => (
          <TreeRow
            key={item.key}
            row={item.row}
            branchKey={item.branchKey}
            branchCollapsed={Boolean(item.branchKey && collapsedBranches.has(item.branchKey))}
            hasDescendants={item.hasDescendants}
            htmlScope={item.htmlScope}
            selectedId={props.selectedId}
            marker={strictUiMarkerForTreeRow(item.row, markers)}
            levelOffset={levelOffset}
            onHover={props.onHover}
            onHoverInternals={props.onHoverInternals}
            onContextMenuRequest={props.onContextMenuRequest}
            onSelect={props.onSelect}
            onToggleBranch={toggleBranch}
            onToggleInternals={props.onToggleInternals}
          />
        ))}
        {props.emptyMessage && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <Layers3 aria-hidden="true" className="mb-3 text-zinc-700" size={24} />
            <p className="text-xs font-medium text-zinc-300">No layers yet</p>
            <p className="mt-1 max-w-48 text-[10px] leading-4 text-zinc-600">{props.emptyMessage}</p>
          </div>
        )}
      </div>

      {!props.emptyMessage && <Switch isSelected={props.showInternals} onChange={() => props.onToggleInternals()}>
        <Switch.Content className="flex h-12 w-full items-center gap-2 border-t border-white/10 px-3 text-left text-xs text-zinc-400 hover:bg-white/[0.03]">
          {props.showInternals ? <Eye size={14} /> : <EyeOff size={14} />}
          <span className="flex-1">
            <span className="block">{props.toggleLabel ?? "Show internal HTML"}</span>
            <span className="block text-[9px] text-zinc-600">{props.toggleHint ?? "Collapsed inside components by default"}</span>
          </span>
          <Switch.Control className="shrink-0"><Switch.Thumb /></Switch.Control>
        </Switch.Content>
      </Switch>}
    </aside>
  );
}

function navigateTree(event: ReactKeyboardEvent<HTMLDivElement>) {
  const target = event.target instanceof HTMLButtonElement
    ? event.target.closest<HTMLButtonElement>('button[role="treeitem"]')
    : null;
  if (!target) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="treeitem"]:not(:disabled)')];
  const current = items.indexOf(target);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? Math.min(items.length - 1, current + 1)
          : Math.max(0, current - 1);
    items[next]?.focus({ preventScroll: true });
    return;
  }
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const branchDisclosure = target.parentElement?.querySelector<HTMLButtonElement>("[data-tree-branch-for]");
  if (branchDisclosure) {
    const expanded = branchDisclosure.getAttribute("aria-expanded") === "true";
    if ((event.key === "ArrowRight" && !expanded) || (event.key === "ArrowLeft" && expanded)) {
      event.preventDefault();
      branchDisclosure.click();
      return;
    }
  }
  const disclosure = target.dataset.treeDisclosure === "true"
    ? target
    : target.parentElement?.querySelector<HTMLButtonElement>("[data-internal-html-toggle-for]");
  if (!disclosure) return;
  const expanded = disclosure.getAttribute("aria-expanded") === "true";
  if ((event.key === "ArrowRight" && !expanded) || (event.key === "ArrowLeft" && expanded)) {
    event.preventDefault();
    disclosure.click();
  }
}
