import type { ComponentControl, ComponentDescriptor } from "../shared/contracts";
import type {
  ComponentPropertyDraft,
  ComponentSlotDraft,
  DesignComponentNode,
  DesignDocument,
  DesignSlotOutletNode,
} from "../shared/design-document";
import type { StrictUiLocation, StrictUiViolation } from "../shared/strict-ui";
import type { ComponentAdapter, TargetModule } from "../shared/target-module";
import {
  validateControls,
  validatePropertyBindingContract,
  validatePublicPropertyDefaults,
} from "./strict-ui-properties";

type StrictSlot = ComponentAdapter["component"]["slots"][number] & { acceptsText?: boolean };

export const CORE_STRICT_UI_VERSION = "design-space.core.v1";

export function validateStrictUi(
  target: TargetModule,
  document: DesignDocument,
  library: readonly DesignDocument[] = [],
): StrictUiViolation[] {
  const violations: StrictUiViolation[] = [];
  const nodeIds = new Set<string>();
  const outlets: DesignSlotOutletNode[] = [];
  const publicSlots = new Map(document.component?.slots.map((slot) => [slot.id, slot]) ?? []);
  const publicProperties = new Map(document.component?.properties.map((property) => [property.id, property]) ?? []);
  validatePublicPropertyDefaults(document.component?.properties ?? [], violations);
  visitNode(target, library, document.root, nodeIds, outlets, publicSlots, publicProperties, violations);
  validateOutlets(document, outlets, violations);
  validatePropertyBindings(target, document, library, violations);
  if (hasAuthoredComponentCycle(document, library)) {
    violations.push({
      ...issue("component.cycle", "Authored components cannot contain themselves through a direct or indirect component cycle.", { kind: "document" }),
      suggestion: "Remove one authored component reference from the implementation cycle.",
    });
  }
  return violations;
}

function validatePropertyBindings(
  target: TargetModule,
  document: DesignDocument,
  library: readonly DesignDocument[],
  violations: StrictUiViolation[],
): void {
  const bindings: Array<{ instanceId: string; targetProp: string; propertyId: string }> = [];
  collectPropertyBindings(document.root, bindings);
  if (document.kind === "screen") {
    for (const binding of bindings) {
      violations.push(issue(
        "binding.screen",
        "Screen nodes cannot bind component definition properties.",
        { kind: "control", instanceId: binding.instanceId, controlId: binding.targetProp },
      ));
    }
    return;
  }
  const properties = new Map(document.component?.properties.map((property) => [property.id, property]) ?? []);
  const counts = new Map<string, number>();
  for (const binding of bindings) {
    const property = properties.get(binding.propertyId);
    const location: StrictUiLocation = { kind: "control", instanceId: binding.instanceId, controlId: binding.targetProp };
    if (!property) {
      violations.push(issue("binding.property", `Binding ${binding.targetProp} references an unavailable public property.`, location));
      continue;
    }
    counts.set(property.id, (counts.get(property.id) ?? 0) + 1);
    const node = findNode(document.root, binding.instanceId);
    const adapter = node ? resolveStrictAdapter(target, library, node.adapterId) : undefined;
    const control = adapter?.controls?.find((candidate) => candidate.prop === binding.targetProp);
    if (!control) {
      violations.push(issue("binding.control", `${property.label} is bound to an unavailable implementation property.`, location));
    } else if (control.kind !== property.kind) {
      violations.push(issue(
        "binding.type",
        `${property.label} (${property.kind}) cannot bind to ${control.label} (${control.kind}).`,
        { kind: "control", instanceId: binding.instanceId, controlId: control.id },
      ));
    } else {
      validatePropertyBindingContract(property, control, location, violations);
    }
  }
  for (const property of properties.values()) {
    const count = counts.get(property.id) ?? 0;
    if (count === 0) {
      violations.push({
        ...issue("binding.missing", `${property.label} must be bound to one implementation property.`, { kind: "document" }),
        suggestion: `Bind ${property.label} in the component workshop before saving.`,
      });
    } else if (count > 1) {
      violations.push(issue("binding.duplicate", `${property.label} is bound more than once.`, { kind: "document" }));
    }
  }
}

function collectPropertyBindings(
  node: DesignComponentNode,
  bindings: Array<{ instanceId: string; targetProp: string; propertyId: string }>,
): void {
  for (const [targetProp, propertyId] of Object.entries(node.propertyBindings ?? {})) {
    bindings.push({ instanceId: node.instanceId, targetProp, propertyId });
  }
  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      if (child.kind === "component") collectPropertyBindings(child.node, bindings);
    }
  }
}

function findNode(node: DesignComponentNode, instanceId: string): DesignComponentNode | undefined {
  if (node.instanceId === instanceId) return node;
  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      if (child.kind !== "component") continue;
      const found = findNode(child.node, instanceId);
      if (found) return found;
    }
  }
  return undefined;
}

function visitNode(
  target: TargetModule,
  library: readonly DesignDocument[],
  node: DesignComponentNode,
  nodeIds: Set<string>,
  outlets: DesignSlotOutletNode[],
  publicSlots: ReadonlyMap<string, ComponentSlotDraft>,
  publicProperties: ReadonlyMap<string, ComponentPropertyDraft>,
  violations: StrictUiViolation[],
): void {
  if (nodeIds.has(node.instanceId)) {
    violations.push(issue("node.duplicate", `Node ${node.instanceId} is used more than once.`, instanceLocation(node.instanceId)));
    return;
  }
  nodeIds.add(node.instanceId);

  const adapter = resolveStrictAdapter(target, library, node.adapterId);
  if (!adapter) {
    violations.push(issue("adapter.unknown", `Component adapter ${node.adapterId} is not registered.`, instanceLocation(node.instanceId)));
    return;
  }

  validateControls(adapter, node, publicProperties, violations);
  const declaredSlots = new Map(adapter.component.slots.map((slot) => [slot.id, slot]));
  for (const slotId of Object.keys(node.slots)) {
    if (!declaredSlots.has(slotId)) {
      violations.push(issue(
        "slot.undeclared",
        `${adapter.component.label} does not declare the ${slotId} slot.`,
        slotLocation(node.instanceId, slotId),
      ));
    }
  }

  for (const slot of adapter.component.slots) {
    const children = node.slots[slot.id];
    if (!children) {
      violations.push(issue("slot.missing", `${slot.label} must be represented, even when empty.`, slotLocation(node.instanceId, slot.id)));
      continue;
    }
    validateSlot(target, library, node, slot, children, nodeIds, outlets, publicSlots, publicProperties, violations);
  }
}

function validateSlot(
  target: TargetModule,
  library: readonly DesignDocument[],
  node: DesignComponentNode,
  slot: StrictSlot,
  children: DesignComponentNode["slots"][string],
  nodeIds: Set<string>,
  outlets: DesignSlotOutletNode[],
  publicSlots: ReadonlyMap<string, ComponentSlotDraft>,
  publicProperties: ReadonlyMap<string, ComponentPropertyDraft>,
  violations: StrictUiViolation[],
): void {
  const location = slotLocation(node.instanceId, slot.id);
  const cardinality = projectedCardinality(children, publicSlots);
  if (cardinality && cardinality.minimum < (slot.min ?? 0)) {
    violations.push(issue("slot.minimum", `${slot.label} requires at least ${slot.min} item${slot.min === 1 ? "" : "s"}.`, location));
  }
  if (slot.max !== undefined && cardinality && (cardinality.maximum === undefined || cardinality.maximum > slot.max)) {
    violations.push(issue("slot.maximum", `${slot.label} allows at most ${slot.max} item${slot.max === 1 ? "" : "s"}.`, location));
  }

  for (const child of children) {
    if (child.kind === "text") {
      registerChildId(child.id, { kind: "document" }, nodeIds, violations);
      if (slot.acceptsText === false) violations.push(issue("slot.text", `${slot.label} does not accept text children.`, location));
      continue;
    }
    if (child.kind === "slot-outlet") {
      registerChildId(child.id, { kind: "slot-outlet", slotId: child.slotId, outletId: child.id }, nodeIds, violations);
      outlets.push(child);
      const publicSlot = publicSlots.get(child.slotId);
      if (publicSlot) validateOutletContract(slot, publicSlot, child, violations);
      continue;
    }
    if (slot.accepts && !slot.accepts.includes(child.node.adapterId)) {
      violations.push(issue("slot.child", `${slot.label} does not accept ${child.node.adapterId}.`, location));
    }
    visitNode(target, library, child.node, nodeIds, outlets, publicSlots, publicProperties, violations);
  }
}

function projectedCardinality(
  children: DesignComponentNode["slots"][string],
  publicSlots: ReadonlyMap<string, ComponentSlotDraft>,
): { minimum: number; maximum: number | undefined } | undefined {
  let minimum = 0;
  let maximum: number | undefined = 0;
  for (const child of children) {
    if (child.kind !== "slot-outlet") {
      minimum += 1;
      if (maximum !== undefined) maximum += 1;
      continue;
    }
    const publicSlot = publicSlots.get(child.slotId);
    if (!publicSlot) return undefined;
    minimum += publicSlot.min ?? 0;
    if (maximum !== undefined) {
      maximum = publicSlot.max === undefined ? undefined : maximum + publicSlot.max;
    }
  }
  return { minimum, maximum };
}

function validateOutletContract(
  containingSlot: StrictSlot,
  publicSlot: ComponentSlotDraft,
  outlet: DesignSlotOutletNode,
  violations: StrictUiViolation[],
): void {
  const location: StrictUiLocation = { kind: "slot-outlet", slotId: outlet.slotId, outletId: outlet.id };
  if (containingSlot.accepts !== undefined) {
    const unsupported = publicSlot.accepts === undefined
      ? undefined
      : publicSlot.accepts.filter((adapterId) => !containingSlot.accepts?.includes(adapterId));
    if (unsupported === undefined || unsupported.length > 0) {
      const detail = unsupported === undefined
        ? "unrestricted components"
        : unsupported.length === 1
          ? unsupported[0]
          : `${unsupported[0]} and ${unsupported.length - 1} more component types`;
      violations.push(issue(
        "outlet.child",
        `${publicSlot.label} allows ${detail}, which ${containingSlot.label} does not accept.`,
        location,
      ));
    }
  }
  if (containingSlot.acceptsText === false && publicSlot.acceptsText !== false) {
    violations.push(issue("outlet.text", `${publicSlot.label} allows text, which ${containingSlot.label} does not accept.`, location));
  }
}

function registerChildId(
  id: string,
  location: StrictUiLocation,
  nodeIds: Set<string>,
  violations: StrictUiViolation[],
): void {
  if (nodeIds.has(id)) {
    violations.push(issue("node.duplicate", `Node ${id} is used more than once.`, location));
  } else {
    nodeIds.add(id);
  }
}

function resolveStrictAdapter(
  target: TargetModule,
  library: readonly DesignDocument[],
  adapterId: string,
): ComponentAdapter | undefined {
  const targetAdapter = target.adapters.find((candidate) => candidate.component.id === adapterId);
  if (targetAdapter) return targetAdapter;
  const authored = library.find((candidate) => candidate.kind === "component" && candidate.component?.id === adapterId);
  if (!authored?.component) return undefined;
  return {
    component: {
      id: authored.component.id,
      label: authored.component.label,
      group: authored.component.group,
      description: authored.component.description,
      slots: authored.component.slots,
    } satisfies ComponentDescriptor,
    controls: authored.component.properties.map(propertyToControl),
    defaultProps: Object.fromEntries(authored.component.properties.flatMap((property) => property.defaultValue === undefined
      ? []
      : [[property.prop, property.defaultValue]])),
    render: () => null,
  };
}

function propertyToControl(property: ComponentPropertyDraft): ComponentControl {
  const common = {
    id: property.id,
    label: property.label,
    prop: property.prop,
    section: property.section,
    description: property.description,
    required: property.required,
  };
  if (property.kind === "text") return { ...common, kind: "text", multiline: property.multiline, maxLength: property.maxLength, placeholder: property.placeholder };
  if (property.kind === "tailwind") return { ...common, kind: "tailwind", presets: property.presets };
  if (property.kind === "boolean") return { ...common, kind: "boolean" };
  if (property.kind === "number") return { ...common, kind: "number", min: property.min, max: property.max, step: property.step, unit: property.unit };
  return {
    ...common,
    kind: "select",
    options: property.options.map((option, index) => ({ id: `${property.id}.option-${index}`, ...option })),
  };
}

function hasAuthoredComponentCycle(document: DesignDocument, library: readonly DesignDocument[]): boolean {
  const definitions = new Map<string, DesignDocument>();
  for (const candidate of [...library, document]) {
    if (candidate.kind === "component" && candidate.component) definitions.set(candidate.component.id, candidate);
  }
  const roots = document.kind === "component" && document.component
    ? [document.component.id]
    : collectAuthoredReferences(document.root, definitions);
  const complete = new Set<string>();
  const visiting = new Set<string>();
  const visit = (componentId: string): boolean => {
    if (visiting.has(componentId)) return true;
    if (complete.has(componentId)) return false;
    const definition = definitions.get(componentId);
    if (!definition) return false;
    visiting.add(componentId);
    if (collectAuthoredReferences(definition.root, definitions).some(visit)) return true;
    visiting.delete(componentId);
    complete.add(componentId);
    return false;
  };
  return roots.some(visit);
}

function collectAuthoredReferences(
  node: DesignComponentNode,
  definitions: ReadonlyMap<string, DesignDocument>,
): string[] {
  const references = definitions.has(node.adapterId) ? [node.adapterId] : [];
  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      if (child.kind === "component") references.push(...collectAuthoredReferences(child.node, definitions));
    }
  }
  return references;
}

function validateOutlets(document: DesignDocument, outlets: readonly DesignSlotOutletNode[], violations: StrictUiViolation[]): void {
  if (document.kind === "screen") {
    for (const outlet of outlets) {
      violations.push(issue("outlet.screen", "Screens cannot contain component slot outlets.", {
        kind: "slot-outlet",
        slotId: outlet.slotId,
        outletId: outlet.id,
      }));
    }
    return;
  }

  const counts = new Map<string, number>();
  for (const outlet of outlets) counts.set(outlet.slotId, (counts.get(outlet.slotId) ?? 0) + 1);
  const declared = new Set(document.component?.slots.map((slot) => slot.id) ?? []);
  for (const outlet of outlets) {
    if (!declared.has(outlet.slotId)) {
      violations.push(issue("outlet.unknown", `Slot outlet ${outlet.slotId} is not declared by the component.`, {
        kind: "slot-outlet",
        slotId: outlet.slotId,
        outletId: outlet.id,
      }));
    }
  }
  for (const slot of document.component?.slots ?? []) {
    const count = counts.get(slot.id) ?? 0;
    if (count !== 1) {
      violations.push(issue(
        count === 0 ? "outlet.missing" : "outlet.duplicate",
        `${slot.label} needs exactly one outlet in the component body.`,
        { kind: "slot-outlet", slotId: slot.id },
      ));
    }
  }
}

function issue(ruleId: string, message: string, location: StrictUiLocation): StrictUiViolation {
  return { ruleId, severity: "error", message, location };
}

function instanceLocation(instanceId: string): StrictUiLocation {
  return { kind: "instance", instanceId };
}

function slotLocation(instanceId: string, slotId: string): StrictUiLocation {
  return { kind: "slot", instanceId, slotId };
}
