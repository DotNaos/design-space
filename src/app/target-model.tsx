import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

import {
  buildComponentTree,
  createAdapterCatalog,
  htmlSelectionId,
  projectPreviewSlots,
  slotSelectionId,
  type AdapterCatalog,
  type ComponentAdapterDefinition,
  type ComponentInstance,
  type ComponentTreeRow,
  type ContractValidationMode,
  type HtmlTreeNode,
  type SelectionTarget,
  type SlotProjection,
} from "../model";
import type {
  ComponentFixture,
  FixtureChild,
  PreviewElementAttributes,
  PreviewSlotAttributes,
  TargetModule,
} from "../shared/target-module";
import type { InternalHtmlNode } from "../shared/contracts";
import type { DesignDocument } from "../shared/design-document";

export interface TargetViewModel {
  catalog: AdapterCatalog;
  root: ComponentInstance;
  rows: readonly ComponentTreeRow[];
  slots: readonly SlotProjection[];
}

export interface TargetViewModelOptions {
  readonly contractValidation?: ContractValidationMode;
}

export function createTargetViewModel(
  target: TargetModule,
  revealInternalHtml: boolean,
  fixture: ComponentFixture = target.defaultFixture,
  componentDocuments: readonly DesignDocument[] = [],
  options: TargetViewModelOptions = {},
): TargetViewModel {
  if (!target.adapters.length) throw new Error("The target has no component adapters.");
  const definitions: ComponentAdapterDefinition[] = [
    ...target.adapters.map((adapter) => ({
    id: adapter.component.id,
    label: adapter.component.label,
    slots: adapter.component.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      accepts: slot.accepts,
      minimum: slot.min,
      maximum: slot.max,
    })),
    defaultProps: target.adapters.find((item) => item.component.id === adapter.component.id)?.defaultProps ?? {},
    internalHtml: adapter.component.internalHtml?.map(toModelHtmlTree),
    })),
    ...componentDocuments.flatMap((document) => document.kind === "component" && document.component ? [{
      id: document.component.id,
      label: document.component.label,
      slots: document.component.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        accepts: slot.accepts,
        minimum: slot.min,
        maximum: slot.max,
      })),
      defaultProps: Object.fromEntries(document.component.properties.flatMap((property) => property.defaultValue === undefined
        ? []
        : [[property.prop, property.defaultValue]])),
    }] : []),
  ];
  const catalog = options.contractValidation === "tolerant"
    ? createTolerantCatalog(definitions)
    : createAdapterCatalog(definitions);
  const root = fixtureToInstance(fixture);
  const revealedInstances = revealInternalHtml ? collectInstanceIds(root) : undefined;
  return {
    catalog,
    root,
    rows: buildComponentTree(catalog, root, {
      revealInternalHtml: revealedInstances,
      contractValidation: options.contractValidation,
    }),
    slots: projectPreviewSlots(catalog, root, {
      contractValidation: options.contractValidation,
    }),
  };
}

function createTolerantCatalog(definitions: readonly ComponentAdapterDefinition[]): AdapterCatalog {
  return { adapters: new Map(definitions.map((definition) => [definition.id, definition])) };
}

export function findComponentInstance(root: ComponentInstance, instanceId: string): ComponentInstance | undefined {
  if (root.instanceId === instanceId) return root;
  for (const slot of root.slots) {
    for (const child of slot.children) {
      if (child.kind !== "component") continue;
      const found = findComponentInstance(child.instance, instanceId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findComponentFixture(root: ComponentFixture, instanceId: string): ComponentFixture | undefined {
  if (root.instanceId === instanceId) return root;
  for (const children of Object.values(root.slots)) {
    for (const child of children) {
      if (child.kind !== "component") continue;
      const found = findComponentFixture(child.node, instanceId);
      if (found) return found;
    }
  }
  return undefined;
}

export function appendFixtureChild(
  root: ComponentFixture,
  parentInstanceId: string,
  slotId: string,
  child: FixtureChild,
): ComponentFixture {
  if (root.instanceId === parentInstanceId) {
    if (!(slotId in root.slots)) throw new Error(`Component ${parentInstanceId} does not declare slot ${slotId}.`);
    return { ...root, slots: { ...root.slots, [slotId]: [...root.slots[slotId], child] } };
  }

  let changed = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([currentSlotId, children]) => [
    currentSlotId,
    children.map((currentChild) => {
      if (currentChild.kind !== "component") return currentChild;
      const nextNode = appendFixtureChildIfFound(currentChild.node, parentInstanceId, slotId, child);
      if (nextNode === currentChild.node) return currentChild;
      changed = true;
      return { ...currentChild, node: nextNode };
    }),
  ]));
  if (!changed) throw new Error(`Component instance ${parentInstanceId} was not found.`);
  return { ...root, slots };
}

export interface FixtureLocation {
  parentInstanceId: string;
  slotId: string;
  index: number;
  siblingCount: number;
}

export function resolveFixtureProps(
  target: TargetModule,
  fixture: ComponentFixture,
): Readonly<Record<string, unknown>> {
  const adapter = target.adapters.find((item) => item.component.id === fixture.adapterId);
  return { ...adapter?.defaultProps, ...fixture.props };
}

export function updateFixtureProps(
  root: ComponentFixture,
  instanceId: string,
  props: Readonly<Record<string, unknown>>,
): ComponentFixture {
  if (root.instanceId === instanceId) return { ...root, props: { ...root.props, ...props } };
  let found = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => [
    slotId,
    children.map((child) => {
      if (child.kind !== "component") return child;
      const next = updateFixturePropsIfFound(child.node, instanceId, props);
      if (next === child.node) return child;
      found = true;
      return { ...child, node: next };
    }),
  ]));
  if (!found) throw new Error(`Component instance ${instanceId} was not found.`);
  return { ...root, slots };
}

export function findFixtureLocation(root: ComponentFixture, instanceId: string): FixtureLocation | undefined {
  for (const [slotId, children] of Object.entries(root.slots)) {
    const index = children.findIndex((child) => child.kind === "component" && child.node.instanceId === instanceId);
    if (index >= 0) return { parentInstanceId: root.instanceId, slotId, index, siblingCount: children.length };
    for (const child of children) {
      if (child.kind !== "component") continue;
      const found = findFixtureLocation(child.node, instanceId);
      if (found) return found;
    }
  }
  return undefined;
}

export function removeFixtureComponent(root: ComponentFixture, instanceId: string): ComponentFixture {
  if (root.instanceId === instanceId) throw new Error("The root component cannot be removed.");
  return updateParentSlot(root, instanceId, (children, index) => children.filter((_, childIndex) => childIndex !== index));
}

export function duplicateFixtureComponent(
  root: ComponentFixture,
  instanceId: string,
  createId: () => string,
): { fixture: ComponentFixture; duplicateId: string } {
  if (root.instanceId === instanceId) throw new Error("The root component cannot be duplicated.");
  let duplicateId = "";
  const fixture = updateParentSlot(root, instanceId, (children, index) => {
    const child = children[index];
    if (child?.kind !== "component") return children;
    const duplicate = cloneFixture(child.node, createId);
    duplicateId = duplicate.instanceId;
    return [...children.slice(0, index + 1), { kind: "component" as const, node: duplicate }, ...children.slice(index + 1)];
  });
  return { fixture, duplicateId };
}

export function moveFixtureComponent(root: ComponentFixture, instanceId: string, offset: -1 | 1): ComponentFixture {
  if (root.instanceId === instanceId) throw new Error("The root component cannot be moved.");
  return updateParentSlot(root, instanceId, (children, index) => {
    const destination = index + offset;
    if (destination < 0 || destination >= children.length) return children;
    const next = [...children];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });
}

export function renderTargetFixture(
  target: TargetModule,
  fixture: ComponentFixture,
  rootProps?: Readonly<Record<string, unknown>>,
  placement?: { parentSlotSelectionId?: string },
): ReactNode {
  const adapter = target.adapters.find((item) => item.component.id === fixture.adapterId);
  if (!adapter) throw new Error(`Missing adapter: ${fixture.adapterId}`);
  const slotChildren = Object.fromEntries(
    adapter.component.slots.map((slot) => [
      slot.id,
      (fixture.slots[slot.id] ?? []).map((child) => renderFixtureChild(target, child, slotSelectionId(fixture.instanceId, slot.id))),
    ]),
  );
  const previewAttributes: PreviewElementAttributes = {
    "data-design-space-instance-id": fixture.instanceId,
    ...(placement?.parentSlotSelectionId
      ? { "data-design-space-parent-slot-id": placement.parentSlotSelectionId }
      : {}),
  };
  const slotAttributes = Object.fromEntries(
    adapter.component.slots.map((slot) => [
      slot.id,
      { "data-design-space-slot-id": slotSelectionId(fixture.instanceId, slot.id) } satisfies PreviewSlotAttributes,
    ]),
  );
  const htmlAttributes = Object.fromEntries(
    flattenInternalHtml(adapter.component.internalHtml ?? []).map((node) => [
      node.id,
      { "data-design-space-html-id": htmlSelectionId(fixture.instanceId, node.id) },
    ]),
  );
  const rendered = adapter.render(
    { ...adapter.defaultProps, ...fixture.props, ...rootProps },
    { slotChildren, previewAttributes, slotAttributes, htmlAttributes },
  );
  return withKey(
    instrumentPreviewNode(rendered, previewAttributes),
    fixture.instanceId,
  );
}

function toModelHtmlTree(node: InternalHtmlNode): HtmlTreeNode {
  return {
    kind: "html" as const,
    id: node.id,
    tagName: node.tagName,
    children: node.children?.map(toModelHtmlTree),
  };
}

function flattenInternalHtml(nodes: readonly InternalHtmlNode[]): readonly InternalHtmlNode[] {
  return nodes.flatMap((node) => [node, ...flattenInternalHtml(node.children ?? [])]);
}

function fixtureToInstance(fixture: ComponentFixture): ComponentInstance {
  return {
    instanceId: fixture.instanceId,
    componentId: fixture.adapterId,
    props: fixture.props,
    slots: Object.entries(fixture.slots).map(([slotId, children]) => ({
      slotId,
      children: children.map((child) => child.kind === "text"
        ? { kind: "text" as const, id: child.id, value: child.value }
        : { kind: "component" as const, instance: fixtureToInstance(child.node) }),
    })),
  };
}

function appendFixtureChildIfFound(
  root: ComponentFixture,
  parentInstanceId: string,
  slotId: string,
  child: FixtureChild,
): ComponentFixture {
  if (root.instanceId === parentInstanceId) {
    if (!(slotId in root.slots)) throw new Error(`Component ${parentInstanceId} does not declare slot ${slotId}.`);
    return { ...root, slots: { ...root.slots, [slotId]: [...root.slots[slotId], child] } };
  }
  let changed = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([currentSlotId, children]) => [
    currentSlotId,
    children.map((currentChild) => {
      if (currentChild.kind !== "component") return currentChild;
      const nextNode = appendFixtureChildIfFound(currentChild.node, parentInstanceId, slotId, child);
      if (nextNode === currentChild.node) return currentChild;
      changed = true;
      return { ...currentChild, node: nextNode };
    }),
  ]));
  return changed ? { ...root, slots } : root;
}

function updateFixturePropsIfFound(
  root: ComponentFixture,
  instanceId: string,
  props: Readonly<Record<string, unknown>>,
): ComponentFixture {
  if (root.instanceId === instanceId) return { ...root, props: { ...root.props, ...props } };
  let changed = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => [
    slotId,
    children.map((child) => {
      if (child.kind !== "component") return child;
      const node = updateFixturePropsIfFound(child.node, instanceId, props);
      if (node === child.node) return child;
      changed = true;
      return { ...child, node };
    }),
  ]));
  return changed ? { ...root, slots } : root;
}

function updateParentSlot(
  root: ComponentFixture,
  instanceId: string,
  update: (children: readonly FixtureChild[], index: number) => readonly FixtureChild[],
): ComponentFixture {
  let found = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => {
    const index = children.findIndex((child) => child.kind === "component" && child.node.instanceId === instanceId);
    if (index >= 0) {
      found = true;
      return [slotId, update(children, index)];
    }
    return [slotId, children.map((child) => {
      if (child.kind !== "component") return child;
      const node = updateParentSlotIfFound(child.node, instanceId, update);
      if (node === child.node) return child;
      found = true;
      return { ...child, node };
    })];
  }));
  if (!found) throw new Error(`Component instance ${instanceId} was not found.`);
  return { ...root, slots };
}

function updateParentSlotIfFound(
  root: ComponentFixture,
  instanceId: string,
  update: (children: readonly FixtureChild[], index: number) => readonly FixtureChild[],
): ComponentFixture {
  let changed = false;
  const slots = Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => {
    const index = children.findIndex((child) => child.kind === "component" && child.node.instanceId === instanceId);
    if (index >= 0) {
      changed = true;
      return [slotId, update(children, index)];
    }
    return [slotId, children.map((child) => {
      if (child.kind !== "component") return child;
      const node = updateParentSlotIfFound(child.node, instanceId, update);
      if (node === child.node) return child;
      changed = true;
      return { ...child, node };
    })];
  }));
  return changed ? { ...root, slots } : root;
}

function cloneFixture(root: ComponentFixture, createId: () => string): ComponentFixture {
  return {
    ...root,
    instanceId: createId(),
    slots: Object.fromEntries(Object.entries(root.slots).map(([slotId, children]) => [
      slotId,
      children.map((child) => child.kind === "component"
        ? { kind: "component" as const, node: cloneFixture(child.node, createId) }
        : { ...child, id: createId() }),
    ])),
  };
}

function collectInstanceIds(root: ComponentInstance): Set<string> {
  const ids = new Set([root.instanceId]);
  for (const slot of root.slots) {
    for (const child of slot.children) {
      if (child.kind === "component") {
        for (const id of collectInstanceIds(child.instance)) ids.add(id);
      }
    }
  }
  return ids;
}

function renderFixtureChild(target: TargetModule, child: FixtureChild, parentSlotSelectionId: string): ReactNode {
  return child.kind === "text"
    ? <span key={child.id} data-design-space-parent-slot-id={parentSlotSelectionId} style={{ display: "contents" }}>{child.value}</span>
    : renderTargetFixture(target, child.node, undefined, { parentSlotSelectionId });
}

function instrumentPreviewNode(node: ReactNode, attributes: PreviewElementAttributes): ReactNode {
  if (!isValidElement(node) || node.type === Fragment) {
    return <span {...attributes} style={{ display: "contents" }}>{node}</span>;
  }
  return cloneElement(node as ReactElement<Record<string, unknown>>, attributes);
}

function withKey(node: ReactNode, key: string): ReactNode {
  return isValidElement(node) ? cloneElement(node, { key }) : node;
}

export function selectionId(selection: SelectionTarget): string {
  return selection.id;
}
