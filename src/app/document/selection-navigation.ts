import type { ComponentTreeRow, SelectionTarget } from "../../model";

export type SelectionNavigationCommand = "child" | "parent" | "next-sibling" | "previous-sibling";

type NavigationNode = {
  selection: SelectionTarget;
  parentId?: string;
  childIds: string[];
  disclosureIds: Set<string>;
};

export type SelectionNavigationIndex = ReadonlyMap<string, Readonly<NavigationNode>>;

export function buildSelectionNavigation(rows: readonly ComponentTreeRow[]): SelectionNavigationIndex {
  const nodes = new Map<string, NavigationNode>();
  const stack: Array<{ depth: number; selectionId?: string; disclosureId?: string }> = [];

  for (const row of rows) {
    while (stack.at(-1) && stack.at(-1)!.depth >= row.depth) stack.pop();
    if (row.kind === "internals-summary") {
      stack.push({ depth: row.depth, disclosureId: row.disclosureId });
      continue;
    }
    if (!("selection" in row)) continue;

    const selection = row.selection;
    const parentId = [...stack].reverse().find((item) => item.selectionId)?.selectionId;
    const disclosureIds = new Set(stack.flatMap((item) => item.disclosureId ? [item.disclosureId] : []));
    if (selection.kind === "html") disclosureIds.add(selection.componentInstanceId);
    for (const item of stack) {
      const parent = item.selectionId ? nodes.get(item.selectionId) : undefined;
      if (parent?.selection.kind === "html") disclosureIds.add(parent.selection.componentInstanceId);
    }

    const existing = nodes.get(selection.id);
    const node = existing ?? { selection, parentId, childIds: [], disclosureIds: new Set<string>() };
    for (const disclosureId of disclosureIds) node.disclosureIds.add(disclosureId);
    nodes.set(selection.id, node);
    if (parentId && parentId !== selection.id) {
      const parent = nodes.get(parentId);
      if (parent && !parent.childIds.includes(selection.id)) parent.childIds.push(selection.id);
    }
    stack.push({ depth: row.depth, selectionId: selection.id });
  }

  return nodes;
}

export function navigateSelection(
  index: SelectionNavigationIndex,
  selectedId: string,
  command: SelectionNavigationCommand,
): SelectionTarget | undefined {
  const current = index.get(selectedId);
  if (!current) return undefined;
  if (command === "child") return current.childIds.length ? index.get(current.childIds[0])?.selection : undefined;
  if (command === "parent") return current.parentId ? index.get(current.parentId)?.selection : undefined;
  if (!current.parentId) return undefined;
  const siblings = index.get(current.parentId)?.childIds ?? [];
  const position = siblings.indexOf(selectedId);
  const next = command === "next-sibling" ? position + 1 : position - 1;
  return next >= 0 && next < siblings.length ? index.get(siblings[next])?.selection : undefined;
}

export function requiredTreeDisclosures(index: SelectionNavigationIndex, selectedId: string): ReadonlySet<string> {
  return new Set(index.get(selectedId)?.disclosureIds ?? []);
}
