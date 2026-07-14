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
      readonly internalHtml?: {
        readonly nodeCount: number;
        readonly collapsed: boolean;
      };
    }
  | {
      readonly kind: "internals-summary";
      readonly disclosureId: string;
      readonly depth: number;
      readonly label: string;
      readonly nodeCount: number;
      readonly collapsed: boolean;
    }
  | {
      readonly kind: "html";
      readonly depth: number;
      readonly label: string;
      readonly selfClosing: boolean;
      readonly selection: Extract<SelectionTarget, { kind: "html" }>;
    }
  | {
      readonly kind: "html-close";
      readonly depth: number;
      readonly label: string;
      readonly id: string;
    }
  | {
      readonly kind: "slot";
      readonly depth: number;
      readonly label: string;
      readonly occupied: boolean;
      readonly childCount: number;
      readonly selection: Extract<SelectionTarget, { kind: "slot" }>;
    }
  | {
      readonly kind: "slot-outlet";
      readonly depth: number;
      readonly label: string;
      readonly selection: Extract<SelectionTarget, { kind: "slot-outlet" }>;
    }
  | { readonly kind: "text"; readonly depth: number; readonly label: string; readonly id: string };

export interface ComponentTreeOptions {
  readonly revealInternalHtml?: ReadonlySet<string>;
  readonly contractValidation?: ContractValidationMode;
}

export interface SlotProjectionOptions {
  readonly contractValidation?: ContractValidationMode;
}

export type ContractValidationMode = "strict" | "tolerant";

export function slotSelectionId(componentInstanceId: string, slotId: string): string {
  return `slot:${encodeURIComponent(componentInstanceId)}:${encodeURIComponent(slotId)}`;
}

export function htmlSelectionId(componentInstanceId: string, nodeId: string): string {
  return `html:${encodeURIComponent(componentInstanceId)}:${encodeURIComponent(nodeId)}`;
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

function appendHtmlRows(
  rows: ComponentTreeRow[],
  nodes: readonly HtmlTreeNode[],
  depth: number,
  componentInstanceId: string,
  appendSlot: (slotId: string, depth: number) => void,
) {
  for (const node of nodes) {
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
    appendHtmlRows(rows, node.children ?? [], depth + 1, componentInstanceId, appendSlot);
    if (node.slotId) appendSlot(node.slotId, depth + 1);
    rows.push({ kind: "html-close", depth, label: node.tagName, id: selectionId });
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

  const internals = adapter.internalHtml ?? [];
  const internalsRevealed = options.revealInternalHtml?.has(instance.instanceId) ?? false;

  rows.push({
    kind: "component",
    depth,
    label: adapter.label,
    selection: { kind: "component", id: instance.instanceId },
    internalHtml: internals.length > 0
      ? { nodeCount: countHtmlNodes(internals), collapsed: !internalsRevealed }
      : undefined,
  });

  const contentBySlot = new Map(instance.slots.map((content) => [content.slotId, content.children]));
  const placedSlots = new Set<string>();
  const appendSlot = (slotId: string, slotDepth: number) => {
    if (placedSlots.has(slotId)) return;
    const slot = adapter.slots.find((candidate) => candidate.id === slotId);
    if (!slot) return;
    placedSlots.add(slotId);
    const children = contentBySlot.get(slot.id) ?? [];
    rows.push({
      kind: "slot",
      depth: slotDepth,
      label: slot.label,
      occupied: children.length > 0,
      childCount: children.length,
      selection: createSlotSelection(instance.instanceId, slot.id),
    });

    for (const child of children) {
      if (child.kind === "component") {
        appendInstanceRows(rows, catalog, child.instance, slotDepth + 1, options);
      } else {
        rows.push({ kind: "text", depth: slotDepth + 1, label: child.value, id: child.id });
      }
    }
  };

  if (internalsRevealed) {
    appendHtmlRows(rows, internals, depth + 1, instance.instanceId, appendSlot);
  }
  for (const slot of adapter.slots) appendSlot(slot.id, depth + 1);
}

const voidHtmlTags = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);

export function buildComponentTree(
  catalog: AdapterCatalog,
  root: ComponentInstance,
  options: ComponentTreeOptions = {},
): readonly ComponentTreeRow[] {
  if (options.contractValidation !== "tolerant") validateComponentInstance(catalog, root);
  const rows: ComponentTreeRow[] = [];
  appendInstanceRows(rows, catalog, root, 0, options);
  return rows;
}

export function projectPreviewSlots(
  catalog: AdapterCatalog,
  instance: ComponentInstance,
  options: SlotProjectionOptions = {},
): readonly SlotProjection[] {
  if (options.contractValidation !== "tolerant") validateComponentInstance(catalog, instance);
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
