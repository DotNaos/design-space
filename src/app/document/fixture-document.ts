import type { DesignComponentNode, DesignDocument, DesignValue } from "../../shared/design-document";
import type { ComponentFixture, FixtureChild, TargetModule } from "../../shared/target-module";

export function createLegacyDocument(target: TargetModule): DesignDocument {
  return {
    schemaVersion: 2,
    id: target.defaultDocumentId ?? "screen.default",
    label: target.defaultDocumentLabel ?? "Main screen",
    kind: "screen",
    root: fixtureToDesignNode(target.defaultFixture),
  };
}

export function fixtureToDesignNode(fixture: ComponentFixture): DesignComponentNode {
  return {
    instanceId: fixture.instanceId,
    adapterId: fixture.adapterId,
    ...(fixture.label ? { label: fixture.label } : {}),
    ...(fixture.props ? { props: designProps(fixture.props) } : {}),
    slots: Object.fromEntries(Object.entries(fixture.slots).map(([slotId, children]) => [
      slotId,
      children.map((child) => child.kind === "text"
        ? { kind: "text" as const, id: child.id, value: child.value }
        : { kind: "component" as const, node: fixtureToDesignNode(child.node) }),
    ])),
  };
}

export function documentToFixture(document: DesignDocument): ComponentFixture {
  return designNodeToFixture(document.root);
}

function designNodeToFixture(node: DesignComponentNode): ComponentFixture {
  return {
    instanceId: node.instanceId,
    adapterId: node.adapterId,
    ...(node.label ? { label: node.label } : {}),
    ...(node.props ? { props: node.props } : {}),
    slots: Object.fromEntries(Object.entries(node.slots).map(([slotId, children]) => [
      slotId,
      children.flatMap<FixtureChild>((child) => {
        if (child.kind === "text") return [{ kind: "text", id: child.id, value: child.value }];
        if (child.kind === "component") return [{ kind: "component", node: designNodeToFixture(child.node) }];
        return [];
      }),
    ])),
  };
}

function designProps(props: Readonly<Record<string, unknown>>): Record<string, DesignValue> {
  return Object.fromEntries(Object.entries(props).flatMap(([key, value]) => {
    const safe = toDesignValue(value);
    return safe === undefined ? [] : [[key, safe]];
  }));
}

function toDesignValue(value: unknown): DesignValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const values = value.map(toDesignValue);
    return values.every((item) => item !== undefined) ? values as DesignValue[] : undefined;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => [key, toDesignValue(item)] as const);
    if (entries.some(([, item]) => item === undefined)) return undefined;
    return Object.fromEntries(entries) as Record<string, DesignValue>;
  }
  return undefined;
}
