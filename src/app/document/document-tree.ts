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
  revealInternalHtml: boolean | ReadonlySet<string>,
  observedDom: PreviewDomSnapshot = {},
): readonly ComponentTreeRow[] {
  const rows: ComponentTreeRow[] = [];
  if (document.kind === "component" && document.component) {
    const implementationDisclosureId = `implementation:${encodeURIComponent(document.id)}`;
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
    const implementationRevealed = isInternalHtmlRevealed(revealInternalHtml, implementationDisclosureId);
    rows.push({
      kind: "internals-summary",
      disclosureId: implementationDisclosureId,
      depth: 1,
      label: "Implementation",
      nodeCount: countDesignNodes(document.root),
      collapsed: !implementationRevealed,
    });
    if (implementationRevealed) appendNode(rows, target, document.root, library, 2, revealInternalHtml, observedDom);
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
  revealInternalHtml: boolean | ReadonlySet<string>,
  observedDom: PreviewDomSnapshot,
): void {
  const adapter = resolveDocumentAdapter(target, library, node.adapterId);
  if (!adapter) return;
  const internals = observedDom[node.instanceId] ?? adapter.component.internalHtml ?? [];
  const internalsRevealed = isInternalHtmlRevealed(revealInternalHtml, node.instanceId);
  rows.push({
    kind: "component",
    depth,
    label: adapter.component.label,
    selection: { kind: "component", id: node.instanceId },
    internalHtml: internals.length > 0
      ? { nodeCount: countInternalNodes(internals), collapsed: !internalsRevealed }
      : undefined,
  });
  const placedSlots = new Set<string>();
  const appendSlot = (slotId: string, slotDepth: number) => {
    if (placedSlots.has(slotId)) return;
    const slot = adapter.component.slots.find((candidate) => candidate.id === slotId);
    if (!slot) return;
    placedSlots.add(slotId);
    const children = node.slots[slot.id] ?? [];
    rows.push({
      kind: "slot",
      depth: slotDepth,
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
      if (child.kind === "component") appendNode(rows, target, child.node, library, slotDepth + 1, revealInternalHtml, observedDom);
      else if (child.kind === "slot-outlet") {
        const definition = documentSlotLabel(library, child.slotId);
        rows.push({
          kind: "slot-outlet",
          depth: slotDepth + 1,
          label: `${definition ?? child.slotId} slot outlet`,
          selection: { kind: "slot-outlet", id: `outlet:${child.id}`, outletId: child.id, slotId: child.slotId },
        });
      } else rows.push({ kind: "text", depth: slotDepth + 1, label: child.value, id: child.id });
    }
  };

  if (internalsRevealed) appendInternalRows(rows, internals, depth + 1, node.instanceId, appendSlot);
  for (const slot of adapter.component.slots) appendSlot(slot.id, depth + 1);
}

function isInternalHtmlRevealed(revealInternalHtml: boolean | ReadonlySet<string>, instanceId: string): boolean {
  return typeof revealInternalHtml === "boolean" ? revealInternalHtml : revealInternalHtml.has(instanceId);
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
  appendSlot: (slotId: string, depth: number) => void,
): void {
  for (const node of nodes ?? []) {
    const selectionId = htmlSelectionId(componentInstanceId, node.id);
    const selfClosing = voidHtmlTags.has(node.tagName);
    rows.push({
      kind: "html",
      depth,
      label: node.tagName,
      selfClosing,
      selection: {
        kind: "html",
        id: selectionId,
        componentInstanceId,
        nodeId: node.id,
      },
    });
    if (selfClosing) continue;
    appendInternalRows(rows, node.children, depth + 1, componentInstanceId, appendSlot);
    if (node.slotId) appendSlot(node.slotId, depth + 1);
    rows.push({ kind: "html-close", depth, label: node.tagName, id: selectionId });
  }
}

const voidHtmlTags = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);
