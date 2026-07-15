import { htmlSelectionId, type SelectionTarget } from "../../model";
import type { DesignComponentNode, DesignDocument } from "../../shared/design-document";
import type { PreviewDomSnapshot } from "../dom/dom-snapshot";

export function documentHtmlClassNames(document: DesignDocument): Readonly<Record<string, string>> {
  const entries: Array<[string, string]> = [];
  if (document.root) collectNodeClassNames(document.root, entries);
  return Object.fromEntries(entries);
}

export function observedHtmlClassName(
  snapshot: PreviewDomSnapshot,
  selection: Extract<SelectionTarget, { kind: "html" }>,
): string {
  return findObservedNode(snapshot[selection.componentInstanceId] ?? [], selection.nodeId)?.className ?? "";
}

function collectNodeClassNames(node: DesignComponentNode, entries: Array<[string, string]>): void {
  for (const [nodeId, className] of Object.entries(node.htmlClassNames ?? {})) {
    entries.push([htmlSelectionId(node.instanceId, nodeId), className]);
  }
  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      if (child.kind === "component") collectNodeClassNames(child.node, entries);
    }
  }
}

function findObservedNode(
  nodes: readonly { id: string; className?: string; children?: readonly unknown[] }[],
  nodeId: string,
): { className?: string } | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const found = findObservedNode((node.children ?? []) as typeof nodes, nodeId);
    if (found) return found;
  }
  return undefined;
}
