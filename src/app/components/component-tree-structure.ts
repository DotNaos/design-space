import type { ComponentTreeRow } from "../../model";

export type HtmlScopeAnnotation = {
  readonly pairId: string;
  readonly depth: number;
  readonly boundary?: "open" | "close";
};

export type AnnotatedTreeRow = {
  readonly row: ComponentTreeRow;
  readonly originalIndex: number;
  readonly key: string;
  readonly branchKey?: string;
  readonly hasDescendants: boolean;
  readonly htmlScope?: HtmlScopeAnnotation;
};

export function annotateTreeRows(
  rows: readonly ComponentTreeRow[],
  selectedId: string,
): readonly AnnotatedTreeRow[] {
  const selectedOpenIndex = rows.findIndex((row) => (
    row.kind === "html" && !row.selfClosing && row.selection.id === selectedId
  ));
  const selectedOpen = selectedOpenIndex >= 0 ? rows[selectedOpenIndex] : undefined;
  const selectedCloseIndex = selectedOpen?.kind === "html"
    ? rows.findIndex((row, index) => index > selectedOpenIndex && row.kind === "html-close" && row.id === selectedOpen.selection.id)
    : -1;

  return rows.map((row, originalIndex) => {
    const hasDescendants = rows[originalIndex + 1]?.depth > row.depth;
    const key = treeRowKey(row, originalIndex);
    const branchKey = hasDescendants ? treeBranchKey(row, originalIndex) : undefined;
    const inSelectedScope = selectedOpen?.kind === "html"
      && selectedCloseIndex >= 0
      && originalIndex >= selectedOpenIndex
      && originalIndex <= selectedCloseIndex;
    return {
      row,
      originalIndex,
      key,
      branchKey,
      hasDescendants,
      htmlScope: inSelectedScope ? {
        pairId: selectedOpen.selection.id,
        depth: selectedOpen.depth,
        boundary: originalIndex === selectedOpenIndex
          ? "open"
          : originalIndex === selectedCloseIndex
            ? "close"
            : undefined,
      } : undefined,
    };
  });
}

export function visibleTreeRows(
  rows: readonly AnnotatedTreeRow[],
  collapsed: ReadonlySet<string>,
): readonly AnnotatedTreeRow[] {
  const visible: AnnotatedTreeRow[] = [];
  let hiddenBelowDepth: number | undefined;
  for (const item of rows) {
    if (hiddenBelowDepth !== undefined && item.row.depth > hiddenBelowDepth) continue;
    hiddenBelowDepth = undefined;
    visible.push(item);
    if (item.branchKey && collapsed.has(item.branchKey)) hiddenBelowDepth = item.row.depth;
  }
  return visible;
}

export function treeSelectionPath(
  rows: readonly AnnotatedTreeRow[],
  selectedId: string,
): readonly string[] {
  const stack: Array<{ key: string; depth: number }> = [];
  for (const item of rows) {
    while (stack.at(-1) && stack.at(-1)!.depth >= item.row.depth) stack.pop();
    if ("selection" in item.row && item.row.selection.id === selectedId) {
      return [...stack.map((ancestor) => ancestor.key), ...(item.branchKey ? [item.branchKey] : [])];
    }
    if (item.branchKey) stack.push({ key: item.branchKey, depth: item.row.depth });
  }
  return [];
}

function treeBranchKey(row: ComponentTreeRow, index: number): string {
  if ("selection" in row) return row.selection.id;
  if (row.kind === "internals-summary") return `internals:${row.disclosureId}`;
  return `row:${row.kind}:${index}`;
}

function treeRowKey(row: ComponentTreeRow, index: number): string {
  if ("selection" in row) return `${row.kind}:${row.selection.id}`;
  if (row.kind === "internals-summary") return `${row.kind}:${row.disclosureId}`;
  if (row.kind === "html-close") return `${row.kind}:${row.id}`;
  return `${row.kind}:${index}`;
}
