import type {
  AdapterCatalog,
  ComponentInstance,
  HtmlTreeNode,
  SelectionTarget,
  SlotProjection,
} from "./contracts";
import { validateComponentInstance } from "./adapter-validation";

export type ComponentTreeRow =
  | {
      readonly kind: "component";
      readonly depth: number;
      readonly label: string;
      readonly selection: Extract<SelectionTarget, { kind: "component" }>;
    }
  | {
      readonly kind: "internals-summary";
      readonly depth: number;
      readonly label: string;
      readonly nodeCount: number;
      readonly collapsed: boolean;
    }
  | {
      readonly kind: "html";
      readonly depth: number;
      readonly label: string;
      readonly selection: Extract<SelectionTarget, { kind: "html" }>;
    }
  | {
      readonly kind: "slot";
      readonly depth: number;
      readonly label: string;
      readonly occupied: boolean;
      readonly childCount: number;
      readonly selection: Extract<SelectionTarget, { kind: "slot" }>;
    }
  | { readonly kind: "text"; readonly depth: number; readonly label: string; readonly id: string };

export interface ComponentTreeOptions {
  readonly revealInternalHtml?: ReadonlySet<string>;
}

export function slotSelectionId(componentInstanceId: string, slotId: string): string {
  return `slot:${encodeURIComponent(componentInstanceId)}:${encodeURIComponent(slotId)}`;
}

export function createSlotSelection(componentInstanceId: string, slotId: string) {
  return {
    kind: "slot" as const,
    id: slotSelectionId(componentInstanceId, slotId),
    componentInstanceId,
    slotId,
  };
}

function countHtmlNodes(nodes: readonly HtmlTreeNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countHtmlNodes(node.children ?? []), 0);
}

function appendHtmlRows(rows: ComponentTreeRow[], nodes: readonly HtmlTreeNode[], depth: number) {
  for (const node of nodes) {
    rows.push({
      kind: "html",
      depth,
      label: node.tagName,
      selection: { kind: "html", id: node.id },
    });
    appendHtmlRows(rows, node.children ?? [], depth + 1);
  }
}

function appendInstanceRows(
  rows: ComponentTreeRow[],
  catalog: AdapterCatalog,
  instance: ComponentInstance,
  depth: number,
  options: ComponentTreeOptions,
) {
  const adapter = catalog.adapters.get(instance.componentId);
  if (!adapter) return;

  rows.push({
    kind: "component",
    depth,
    label: adapter.label,
    selection: { kind: "component", id: instance.instanceId },
  });

  const internals = adapter.internalHtml ?? [];
  if (internals.length > 0) {
    const revealed = options.revealInternalHtml?.has(instance.instanceId) ?? false;
    rows.push({
      kind: "internals-summary",
      depth: depth + 1,
      label: "Internal HTML",
      nodeCount: countHtmlNodes(internals),
      collapsed: !revealed,
    });
    if (revealed) appendHtmlRows(rows, internals, depth + 2);
  }

  const contentBySlot = new Map(instance.slots.map((content) => [content.slotId, content.children]));
  for (const slot of adapter.slots) {
    const children = contentBySlot.get(slot.id) ?? [];
    rows.push({
      kind: "slot",
      depth: depth + 1,
      label: slot.label,
      occupied: children.length > 0,
      childCount: children.length,
      selection: createSlotSelection(instance.instanceId, slot.id),
    });

    for (const child of children) {
      if (child.kind === "component") {
        appendInstanceRows(rows, catalog, child.instance, depth + 2, options);
      } else {
        rows.push({ kind: "text", depth: depth + 2, label: child.value, id: child.id });
      }
    }
  }
}

export function buildComponentTree(
  catalog: AdapterCatalog,
  root: ComponentInstance,
  options: ComponentTreeOptions = {},
): readonly ComponentTreeRow[] {
  validateComponentInstance(catalog, root);
  const rows: ComponentTreeRow[] = [];
  appendInstanceRows(rows, catalog, root, 0, options);
  return rows;
}

export function projectPreviewSlots(
  catalog: AdapterCatalog,
  instance: ComponentInstance,
): readonly SlotProjection[] {
  validateComponentInstance(catalog, instance);
  const adapter = catalog.adapters.get(instance.componentId);
  if (!adapter) return [];
  const contentBySlot = new Map(instance.slots.map((content) => [content.slotId, content.children]));

  return adapter.slots.map((slot) => {
    const childCount = contentBySlot.get(slot.id)?.length ?? 0;
    return {
      selection: createSlotSelection(instance.instanceId, slot.id),
      label: slot.label,
      occupied: childCount > 0,
      childCount,
    };
  });
}
