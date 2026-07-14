import type {
  ComponentDefinitionDraft,
  ComponentPropertyDraft,
  ComponentSlotDraft,
  DesignChild,
  DesignComponentNode,
  DesignDocument,
  DesignValue,
} from "../../shared/design-document";

export function findDesignNode(root: DesignComponentNode, instanceId: string): DesignComponentNode | undefined {
  if (root.instanceId === instanceId) return root;
  for (const children of Object.values(root.slots)) {
    for (const child of children) {
      if (child.kind !== "component") continue;
      const found = findDesignNode(child.node, instanceId);
      if (found) return found;
    }
  }
  return undefined;
}

export interface DesignNodeLocation {
  parentInstanceId: string;
  slotId: string;
  index: number;
  siblingCount: number;
}

export function updateDocumentLabel(document: DesignDocument, label: string): DesignDocument {
  return document.kind === "component" && document.component
    ? { ...document, label, component: { ...document.component, label } }
    : { ...document, label };
}

export function findDesignNodeLocation(root: DesignComponentNode, instanceId: string): DesignNodeLocation | undefined {
  for (const [slotId, children] of Object.entries(root.slots)) {
    const index = children.findIndex((child) => child.kind === "component" && child.node.instanceId === instanceId);
    if (index >= 0) return { parentInstanceId: root.instanceId, slotId, index, siblingCount: children.length };
    for (const child of children) {
      if (child.kind !== "component") continue;
      const found = findDesignNodeLocation(child.node, instanceId);
      if (found) return found;
    }
  }
  return undefined;
}

export function updateDesignProps(
  document: DesignDocument,
  instanceId: string,
  props: Readonly<Record<string, DesignValue | undefined>>,
): DesignDocument {
  return updateDocumentRoot(document, instanceId, (node) => {
    const nextProps = { ...node.props };
    for (const [prop, value] of Object.entries(props)) {
      if (value === undefined) delete nextProps[prop];
      else nextProps[prop] = value;
    }
    return { ...node, props: Object.keys(nextProps).length ? nextProps : undefined };
  });
}

export function bindComponentProperty(
  document: DesignDocument,
  propertyId: string,
  target?: { instanceId: string; prop: string },
): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents bind public properties.");
  if (!document.component.properties.some((property) => property.id === propertyId)) {
    throw new Error(`Property ${propertyId} was not found.`);
  }
  let root = removePropertyBinding(document.root, propertyId);
  if (target) {
    root = updateNode(root, target.instanceId, (node) => ({
      ...node,
      propertyBindings: { ...node.propertyBindings, [target.prop]: propertyId },
    }));
    if (!findDesignNode(root, target.instanceId)) throw new Error(`Component instance ${target.instanceId} was not found.`);
  }
  return { ...document, root };
}

export function insertDesignChild(
  document: DesignDocument,
  parentInstanceId: string,
  slotId: string,
  child: DesignChild,
): DesignDocument {
  return updateDocumentRoot(document, parentInstanceId, (node) => {
    const children = node.slots[slotId];
    if (!children) throw new Error(`Component ${parentInstanceId} does not declare slot ${slotId}.`);
    return { ...node, slots: { ...node.slots, [slotId]: [...children, child] } };
  });
}

export function removeDesignComponent(document: DesignDocument, instanceId: string): DesignDocument {
  if (document.root.instanceId === instanceId) throw new Error("The root component cannot be removed.");
  const root = updateParentChildren(document.root, instanceId, (children, index) => children.filter((_, item) => item !== index));
  if (root === document.root) throw new Error(`Component instance ${instanceId} was not found.`);
  return { ...document, root };
}

export function moveDesignComponent(document: DesignDocument, instanceId: string, offset: -1 | 1): DesignDocument {
  if (document.root.instanceId === instanceId) throw new Error("The root component cannot be moved.");
  const root = updateParentChildren(document.root, instanceId, (children, index) => {
    const destination = index + offset;
    if (destination < 0 || destination >= children.length) return children;
    const next = [...children];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });
  if (root === document.root) throw new Error(`Component instance ${instanceId} was not found.`);
  return { ...document, root };
}

export function duplicateDesignComponent(
  document: DesignDocument,
  instanceId: string,
  createId: () => string,
): { document: DesignDocument; duplicateId: string } {
  if (document.root.instanceId === instanceId) throw new Error("The root component cannot be duplicated.");
  let duplicateId = "";
  const root = updateParentChildren(document.root, instanceId, (children, index) => {
    const child = children[index];
    if (child?.kind !== "component") return children;
    const duplicate = cloneDesignNode(child.node, createId);
    duplicateId = duplicate.instanceId;
    return [...children.slice(0, index + 1), { kind: "component" as const, node: duplicate }, ...children.slice(index + 1)];
  });
  if (!duplicateId || root === document.root) throw new Error(`Component instance ${instanceId} was not found.`);
  return { document: { ...document, root }, duplicateId };
}

export function addComponentSlot(
  document: DesignDocument,
  slot: ComponentSlotDraft,
  outletParentInstanceId = document.root.instanceId,
  outletParentSlotId?: string,
  createId: () => string = defaultId,
): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents define slots.");
  if (document.component.slots.some((item) => item.id === slot.id)) throw new Error(`Slot ${slot.id} already exists.`);
  const next = { ...document, component: { ...document.component, slots: [...document.component.slots, slot] } };
  if (!outletParentSlotId) return next;
  return insertDesignChild(next, outletParentInstanceId, outletParentSlotId, {
    kind: "slot-outlet",
    id: createId(),
    slotId: slot.id,
  });
}

export function updateComponentDefinition(
  document: DesignDocument,
  patch: Partial<Pick<ComponentDefinitionDraft, "label" | "group" | "description">>,
): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents have definitions.");
  const updated = { ...document, component: { ...document.component, ...patch } };
  return patch.label === undefined ? updated : updateDocumentLabel(updated, patch.label);
}

export function updateComponentSlot(
  document: DesignDocument,
  slotId: string,
  patch: Partial<Omit<ComponentSlotDraft, "id">>,
): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents define slots.");
  if (!document.component.slots.some((slot) => slot.id === slotId)) throw new Error(`Slot ${slotId} was not found.`);
  return {
    ...document,
    component: {
      ...document.component,
      slots: document.component.slots.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot),
    },
  };
}

export function removeComponentSlot(document: DesignDocument, slotId: string): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents define slots.");
  return {
    ...document,
    component: {
      ...document.component,
      slots: document.component.slots.filter((slot) => slot.id !== slotId),
    },
    root: removeSlotOutlets(document.root, slotId),
  };
}

export function addComponentProperty(document: DesignDocument, property: ComponentPropertyDraft): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents define properties.");
  if (document.component.properties.some((item) => item.id === property.id || item.prop === property.prop)) {
    throw new Error(`Property ${property.id} already exists.`);
  }
  return { ...document, component: { ...document.component, properties: [...document.component.properties, property] } };
}

export function updateComponentProperty(
  document: DesignDocument,
  propertyId: string,
  update: (property: ComponentPropertyDraft) => ComponentPropertyDraft,
): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents define properties.");
  if (!document.component.properties.some((property) => property.id === propertyId)) throw new Error(`Property ${propertyId} was not found.`);
  return {
    ...document,
    component: {
      ...document.component,
      properties: document.component.properties.map((property) => property.id === propertyId ? update(property) : property),
    },
  };
}

export function removeComponentProperty(document: DesignDocument, propertyId: string): DesignDocument {
  if (document.kind !== "component" || !document.component) throw new Error("Only component documents define properties.");
  return {
    ...document,
    component: {
      ...document.component,
      properties: document.component.properties.filter((property) => property.id !== propertyId),
    },
    root: removePropertyBinding(document.root, propertyId),
  };
}

function removePropertyBinding(root: DesignComponentNode, propertyId: string): DesignComponentNode {
  let changed = false;
  const propertyBindings = Object.fromEntries(Object.entries(root.propertyBindings ?? {}).filter(([, boundId]) => {
    if (boundId !== propertyId) return true;
    changed = true;
    return false;
  }));
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => [
    slotId,
    children.map((child) => {
      if (child.kind !== "component") return child;
      const node = removePropertyBinding(child.node, propertyId);
      if (node === child.node) return child;
      changed = true;
      return { ...child, node };
    }),
  ]));
  return changed ? {
    ...root,
    propertyBindings: Object.keys(propertyBindings).length ? propertyBindings : undefined,
    slots,
  } : root;
}

function updateDocumentRoot(
  document: DesignDocument,
  instanceId: string,
  update: (node: DesignComponentNode) => DesignComponentNode,
): DesignDocument {
  const root = updateNode(document.root, instanceId, update);
  if (root === document.root) throw new Error(`Component instance ${instanceId} was not found.`);
  return { ...document, root };
}

function updateNode(
  root: DesignComponentNode,
  instanceId: string,
  update: (node: DesignComponentNode) => DesignComponentNode,
): DesignComponentNode {
  if (root.instanceId === instanceId) return update(root);
  let changed = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => [
    slotId,
    children.map((child) => {
      if (child.kind !== "component") return child;
      const node = updateNode(child.node, instanceId, update);
      if (node === child.node) return child;
      changed = true;
      return { ...child, node };
    }),
  ]));
  return changed ? { ...root, slots } : root;
}

function updateParentChildren(
  root: DesignComponentNode,
  instanceId: string,
  update: (children: readonly DesignChild[], index: number) => readonly DesignChild[],
): DesignComponentNode {
  let changed = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => {
    const index = children.findIndex((child) => child.kind === "component" && child.node.instanceId === instanceId);
    if (index >= 0) {
      const next = [...update(children, index)];
      if (next !== children) changed = true;
      return [slotId, next];
    }
    return [slotId, children.map((child) => {
      if (child.kind !== "component") return child;
      const node = updateParentChildren(child.node, instanceId, update);
      if (node === child.node) return child;
      changed = true;
      return { ...child, node };
    })];
  }));
  return changed ? { ...root, slots } : root;
}

function cloneDesignNode(root: DesignComponentNode, createId: () => string): DesignComponentNode {
  const { propertyBindings: _bindings, ...copy } = root;
  return {
    ...copy,
    instanceId: createId(),
    slots: Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => [
      slotId,
      children.map((child) => {
        if (child.kind === "component") return { ...child, node: cloneDesignNode(child.node, createId) };
        return { ...child, id: createId() };
      }),
    ])),
  };
}

function removeSlotOutlets(root: DesignComponentNode, slotId: string): DesignComponentNode {
  return {
    ...root,
    slots: Object.fromEntries(Object.entries(root.slots).map(([parentSlotId, children]) => [
      parentSlotId,
      children.flatMap<DesignChild>((child) => {
        if (child.kind === "slot-outlet" && child.slotId === slotId) return [];
        if (child.kind === "component") return [{ ...child, node: removeSlotOutlets(child.node, slotId) }];
        return [child];
      }),
    ])),
  };
}

function defaultId(): string {
  return `outlet-${crypto.randomUUID()}`;
}
