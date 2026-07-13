import { cloneElement, isValidElement, type ReactNode } from "react";

import {
  buildComponentTree,
  createAdapterCatalog,
  projectPreviewSlots,
  type AdapterCatalog,
  type ComponentInstance,
  type ComponentTreeRow,
  type SelectionTarget,
  type SlotProjection,
} from "../model";
import type { ComponentFixture, FixtureChild, TargetModule } from "../shared/target-module";

export interface TargetViewModel {
  catalog: AdapterCatalog;
  root: ComponentInstance;
  rows: readonly ComponentTreeRow[];
  slots: readonly SlotProjection[];
}

export function createTargetViewModel(
  target: TargetModule,
  revealInternalHtml: boolean,
  fixture: ComponentFixture = target.defaultFixture,
): TargetViewModel {
  if (!target.adapters.length) throw new Error("The target has no component adapters.");
  if (fixture.adapterId !== target.defaultAdapterId) {
    throw new Error("The target fixture does not match its default adapter.");
  }
  const catalog = createAdapterCatalog(target.adapters.map((adapter) => ({
    id: adapter.component.id,
    label: adapter.component.label,
    slots: adapter.component.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      accepts: slot.accepts,
      minimum: slot.min,
      maximum: slot.max,
    })),
    defaultProps: {},
    internalHtml: adapter.component.internalHtml?.map((node) => ({
      kind: "html" as const,
      id: node.id,
      tagName: node.tagName,
    })),
  })));
  const root = fixtureToInstance(fixture);
  const revealedInstances = revealInternalHtml ? collectInstanceIds(root) : undefined;
  return {
    catalog,
    root,
    rows: buildComponentTree(catalog, root, {
      revealInternalHtml: revealedInstances,
    }),
    slots: projectPreviewSlots(catalog, root),
  };
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

export function renderTargetFixture(
  target: TargetModule,
  fixture: ComponentFixture,
  rootProps?: Readonly<Record<string, unknown>>,
): ReactNode {
  const adapter = target.adapters.find((item) => item.component.id === fixture.adapterId);
  if (!adapter) throw new Error(`Missing adapter: ${fixture.adapterId}`);
  const slotChildren = Object.fromEntries(
    Object.entries(fixture.slots).map(([slotId, children]) => [
      slotId,
      children.map((child) => renderFixtureChild(target, child)),
    ]),
  );
  return withKey(
    adapter.render({ ...fixture.props, ...rootProps }, { slotChildren }),
    fixture.instanceId,
  );
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

function renderFixtureChild(target: TargetModule, child: FixtureChild): ReactNode {
  return child.kind === "text" ? child.value : renderTargetFixture(target, child.node);
}

function withKey(node: ReactNode, key: string): ReactNode {
  return isValidElement(node) ? cloneElement(node, { key }) : node;
}

export function selectionId(selection: SelectionTarget): string {
  return selection.id;
}
