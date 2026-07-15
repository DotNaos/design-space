import type {
  AdapterCatalog,
  ComponentAdapterDefinition,
  ComponentInstance,
  SlotChild,
  SlotDefinition,
} from "./contracts";

export class AdapterContractError extends Error {
  readonly code:
    | "duplicate-component"
    | "duplicate-slot"
    | "unknown-component"
    | "unknown-slot"
    | "duplicate-slot-content"
    | "slot-underflow"
    | "slot-overflow"
    | "rejected-child";

  constructor(code: AdapterContractError["code"], message: string) {
    super(message);
    this.name = "AdapterContractError";
    this.code = code;
  }
}

function assertSlotDefinition(adapter: ComponentAdapterDefinition, slot: SlotDefinition) {
  if (slot.minimum !== undefined && slot.minimum < 0) {
    throw new AdapterContractError("slot-underflow", `${adapter.id}.${slot.id} has a negative minimum`);
  }

  if (slot.maximum !== undefined && slot.maximum < 0) {
    throw new AdapterContractError("slot-overflow", `${adapter.id}.${slot.id} has a negative maximum`);
  }

  if (slot.minimum !== undefined && slot.maximum !== undefined && slot.minimum > slot.maximum) {
    throw new AdapterContractError("slot-overflow", `${adapter.id}.${slot.id} has an impossible range`);
  }
}

export function createAdapterCatalog(
  adapters: readonly ComponentAdapterDefinition[],
): AdapterCatalog {
  const byId = new Map<string, ComponentAdapterDefinition>();

  for (const adapter of adapters) {
    if (byId.has(adapter.id)) {
      throw new AdapterContractError("duplicate-component", `Duplicate component adapter: ${adapter.id}`);
    }

    const slotIds = new Set<string>();
    for (const slot of adapter.slots) {
      if (slotIds.has(slot.id)) {
        throw new AdapterContractError("duplicate-slot", `Duplicate slot: ${adapter.id}.${slot.id}`);
      }
      slotIds.add(slot.id);
      assertSlotDefinition(adapter, slot);
    }
    byId.set(adapter.id, adapter);
  }

  return { adapters: byId };
}

function validateAcceptedChild(slot: SlotDefinition, child: SlotChild) {
  if (child.kind === "text") {
    return;
  }

  if (slot.accepts !== undefined && !slot.accepts.includes(child.instance.componentId)) {
    throw new AdapterContractError(
      "rejected-child",
      `${child.instance.componentId} is not accepted by slot ${slot.id}`,
    );
  }
}

export function validateComponentInstance(
  catalog: AdapterCatalog,
  instance: ComponentInstance,
): void {
  const adapter = catalog.adapters.get(instance.componentId);
  if (!adapter) {
    throw new AdapterContractError("unknown-component", `Unknown component: ${instance.componentId}`);
  }

  const assignedSlots = new Set<string>();
  const declaredSlots = new Map(adapter.slots.map((slot) => [slot.id, slot]));

  for (const content of instance.slots) {
    const slot = declaredSlots.get(content.slotId);
    if (!slot) {
      throw new AdapterContractError(
        "unknown-slot",
        `${instance.componentId} does not declare slot ${content.slotId}`,
      );
    }
    if (assignedSlots.has(content.slotId)) {
      throw new AdapterContractError(
        "duplicate-slot-content",
        `Slot ${instance.componentId}.${content.slotId} is assigned more than once`,
      );
    }
    assignedSlots.add(content.slotId);

    if (slot.minimum !== undefined && content.children.length < slot.minimum) {
      throw new AdapterContractError("slot-underflow", `Slot ${slot.id} requires ${slot.minimum} children`);
    }
    if (slot.maximum !== undefined && content.children.length > slot.maximum) {
      throw new AdapterContractError("slot-overflow", `Slot ${slot.id} allows ${slot.maximum} children`);
    }

    for (const child of content.children) {
      validateAcceptedChild(slot, child);
      if (child.kind === "component") {
        validateComponentInstance(catalog, child.instance);
      }
    }
  }

  for (const slot of adapter.slots) {
    if ((slot.minimum ?? 0) > 0 && !assignedSlots.has(slot.id)) {
      throw new AdapterContractError("slot-underflow", `Slot ${slot.id} requires content`);
    }
  }
}
