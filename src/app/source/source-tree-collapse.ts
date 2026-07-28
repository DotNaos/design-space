import type { SourceFocusRow } from "./source-focus-tree";

export function collapseSourceBranchesOutsideFocus(
  rows: readonly SourceFocusRow[],
  focusId: string | undefined,
  current: ReadonlySet<string>,
  isOutsideActiveFile: (row: SourceFocusRow) => boolean = () => false,
): ReadonlySet<string> {
  const focusIndex = rows.findIndex((row) => (
    row.kind === "component"
    && !row.layer
    && row.occurrence?.id === focusId
  ));
  if (focusIndex < 0) return current;

  const focusDepth = rows[focusIndex]!.depth;
  const focusEnd = rows.findIndex((row, index) => (
    index > focusIndex && row.depth <= focusDepth
  ));
  const subtreeEnd = focusEnd < 0 ? rows.length : focusEnd;
  const ancestorKeys = ancestorRowKeys(rows, focusIndex);
  const next = new Set(current);

  rows.forEach((row, index) => {
    if (!row.collapsible) return;
    if (ancestorKeys.has(row.key) || index === focusIndex) {
      next.delete(row.key);
      return;
    }
    if (
      index < focusIndex
      || index >= subtreeEnd
      || isOutsideActiveFile(row)
    ) {
      next.add(row.key);
    }
  });

  return next;
}

function ancestorRowKeys(
  rows: readonly SourceFocusRow[],
  selectedIndex: number,
): ReadonlySet<string> {
  const keys = new Set<string>();
  let parentDepth = (rows[selectedIndex]?.depth ?? 0) - 1;
  for (let index = selectedIndex - 1; index >= 0 && parentDepth >= 0; index -= 1) {
    const row = rows[index]!;
    if (row.depth !== parentDepth) continue;
    keys.add(row.key);
    parentDepth -= 1;
  }
  return keys;
}
