import type { ComponentTreeRow } from "../../model";
import { htmlSelectionId } from "../../model";
import type { InternalHtmlNode } from "../../shared/contracts";
import type { PreviewDomSnapshot } from "../dom/dom-snapshot";
import type { DesignComponentNode, DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { resolveDocumentAdapter } from "./document-adapters";

export function buildDesignDocumentTree(
  target: TargetModule,
  document: DesignDocument,
  library: readonly DesignDocument[],
  revealInternalHtml: boolean,
  observedDom: PreviewDomSnapshot = {},
): readonly ComponentTreeRow[] {
  const rows: ComponentTreeRow[] = [];
  if (document.kind === "component" && document.component) {
    rows.push({
      kind: "component",
      depth: 0,
      label: document.component.label,
      selection: { kind: "component", id: document.root.instanceId },
    });
    const outlets = collectSlotOutlets(document.root);
    for (const slot of document.component.slots) {
      const outlet = outlets.find((candidate) => candidate.slotId === slot.id);
      if (outlet) {
        rows.push({
          kind: "slot-outlet",
          depth: 1,
          label: `${slot.label} slot · outlet linked`,
          selection: { kind: "slot-outlet", id: `outlet:${outlet.id}`, outletId: outlet.id, slotId: slot.id },
        });
      } else {
        rows.push({ kind: "text", depth: 1, label: `${slot.label} slot · outlet missing`, id: `missing-outlet-${slot.id}` });
      }
    }
    rows.push({
      kind: "internals-summary",
      depth: 1,
      label: "Implementation",
      nodeCount: countDesignNodes(document.root),
      collapsed: !revealInternalHtml,
    });
    if (revealInternalHtml) appendNode(rows, target, document.root, library, 2, true, observedDom);
    return rows;
  }
  appendNode(rows, target, document.root, library, 0, revealInternalHtml, observedDom);
  return rows;
}

function collectSlotOutlets(node: DesignComponentNode): Array<{ id: string; slotId: string }> {
  return Object.values(node.slots).flatMap((children) => children.flatMap((child) => {
    if (child.kind === "slot-outlet") return [{ id: child.id, slotId: child.slotId }];
    if (child.kind === "component") return collectSlotOutlets(child.node);
    return [];
  }));
}

function countDesignNodes(node: DesignComponentNode): number {
  return 1 + Object.values(node.slots).reduce((total, children) => total + children.reduce((count, child) => (
    count + (child.kind === "component" ? countDesignNodes(child.node) : 1)
  ), 0), 0);
}

function appendNode(
  rows: ComponentTreeRow[],
  target: TargetModule,
  node: DesignComponentNode,
  library: readonly DesignDocument[],
  depth: number,
  revealInternalHtml: boolean,
  observedDom: PreviewDomSnapshot,
): void {
  const adapter = resolveDocumentAdapter(target, library, node.adapterId);
  if (!adapter) return;
  rows.push({
    kind: "component",
    depth,
    label: adapter.component.label,
    selection: { kind: "component", id: node.instanceId },
  });
  const internals = observedDom[node.instanceId] ?? adapter.component.internalHtml ?? [];
  if (internals.length) {
    rows.push({
      kind: "internals-summary",
      depth: depth + 1,
      label: "Internal HTML",
      nodeCount: countInternalNodes(internals),
      collapsed: !revealInternalHtml,
    });
    if (revealInternalHtml) appendInternalRows(rows, internals, depth + 2, node.instanceId);
  }
  for (const slot of adapter.component.slots) {
    const children = node.slots[slot.id] ?? [];
    rows.push({
      kind: "slot",
      depth: depth + 1,
      label: slot.label,
      occupied: children.length > 0,
      childCount: children.length,
      selection: {
        kind: "slot",
        id: `slot:${encodeURIComponent(node.instanceId)}:${encodeURIComponent(slot.id)}`,
        componentInstanceId: node.instanceId,
        slotId: slot.id,
      },
    });
    for (const child of children) {
      if (child.kind === "component") appendNode(rows, target, child.node, library, depth + 2, revealInternalHtml, observedDom);
      else if (child.kind === "slot-outlet") {
        const definition = documentSlotLabel(library, child.slotId);
        rows.push({
          kind: "slot-outlet",
          depth: depth + 2,
          label: `${definition ?? child.slotId} slot outlet`,
          selection: { kind: "slot-outlet", id: `outlet:${child.id}`, outletId: child.id, slotId: child.slotId },
        });
      } else rows.push({ kind: "text", depth: depth + 2, label: child.value, id: child.id });
    }
  }
}

function documentSlotLabel(library: readonly DesignDocument[], slotId: string): string | undefined {
  for (const document of library) {
    const slot = document.component?.slots.find((candidate) => candidate.id === slotId);
    if (slot) return slot.label;
  }
  return undefined;
}

function countInternalNodes(nodes: readonly InternalHtmlNode[] | undefined): number {
  return (nodes ?? []).reduce((count, node) => count + 1 + countInternalNodes(node.children), 0);
}

function appendInternalRows(
  rows: ComponentTreeRow[],
  nodes: readonly InternalHtmlNode[] | undefined,
  depth: number,
  componentInstanceId: string,
): void {
  for (const node of nodes ?? []) {
    rows.push({
      kind: "html",
      depth,
      label: node.tagName,
      selection: {
        kind: "html",
        id: htmlSelectionId(componentInstanceId, node.id),
        componentInstanceId,
        nodeId: node.id,
      },
    });
    appendInternalRows(rows, node.children, depth + 1, componentInstanceId);
  }
}
