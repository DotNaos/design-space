import type { ReactNode } from "react";

import dashboardSource from "./dashboard.design.json";
import panelSource from "./panel.design.json";
import { Card, cardSourceClassName } from "./Card";

type Value = string | number | boolean | null;
type Child =
  | { kind: "text"; id: string; value: string }
  | { kind: "slot-outlet"; id: string; slotId: string }
  | { kind: "component"; node: Node };
type Node = {
  instanceId: string;
  adapterId: string;
  props?: Record<string, Value>;
  propertyBindings?: Record<string, string>;
  slots: Record<string, Child[]>;
};
type ComponentDocument = {
  id: string;
  component: {
    id: string;
    properties: Array<{ id: string; prop: string; defaultValue?: Value }>;
  };
  root: Node;
};
type ScreenDocument = { id: string; root: Node };

const dashboard = dashboardSource as ScreenDocument;
const panel = panelSource as ComponentDocument;
const components = new Map([[panel.component.id, panel]]);

export function ProductionApp() {
  return (
    <main data-production-document={dashboard.id} className="min-h-screen bg-zinc-900 p-6">
      {renderNode(dashboard.root)}
    </main>
  );
}

function renderNode(node: Node, key: string = node.instanceId): ReactNode {
  const component = components.get(node.adapterId);
  if (component) {
    const values = {
      ...Object.fromEntries(component.component.properties.flatMap((property) => (
        property.defaultValue === undefined ? [] : [[property.prop, property.defaultValue]]
      ))),
      ...node.props,
    };
    return (
      <div key={key} data-production-component={component.id} data-production-instance={node.instanceId}>
        {renderTemplate(component.root, component, values, node.slots)}
      </div>
    );
  }
  return renderTarget(node, node.props ?? {}, renderSlots(node.slots), key);
}

function renderTemplate(
  node: Node,
  component: ComponentDocument,
  publicValues: Readonly<Record<string, Value>>,
  externalSlots: Readonly<Record<string, readonly Child[]>>,
): ReactNode {
  const properties = new Map(component.component.properties.map((property) => [property.id, property]));
  const bound = Object.fromEntries(Object.entries(node.propertyBindings ?? {}).flatMap(([targetProp, propertyId]) => {
    const property = properties.get(propertyId);
    const value = property ? publicValues[property.prop] : undefined;
    return value === undefined ? [] : [[targetProp, value]];
  }));
  const slots = Object.fromEntries(Object.entries(node.slots).map(([slotId, children]) => [
    slotId,
    children.flatMap((child) => child.kind === "slot-outlet"
      ? (externalSlots[child.slotId] ?? []).map((external, index) => renderChild(external, `${child.id}-${index}`))
      : [child.kind === "component"
          ? renderTemplate(child.node, component, publicValues, externalSlots)
          : renderChild(child, child.id)]),
  ]));
  return renderTarget(node, { ...node.props, ...bound }, slots, node.instanceId);
}

function renderSlots(slots: Readonly<Record<string, readonly Child[]>>): Readonly<Record<string, readonly ReactNode[]>> {
  return Object.fromEntries(Object.entries(slots).map(([slotId, children]) => [
    slotId,
    children.map((child, index) => renderChild(child, `${slotId}-${index}`)),
  ]));
}

function renderChild(child: Child, key: string): ReactNode {
  if (child.kind === "text") return <span key={key}>{child.value}</span>;
  if (child.kind === "slot-outlet") return null;
  return renderNode(child.node, key);
}

function renderTarget(
  node: Node,
  props: Readonly<Record<string, Value>>,
  slots: Readonly<Record<string, readonly ReactNode[]>>,
  key: string,
): ReactNode {
  const className = stringValue(props.className, "");
  if (node.adapterId === "card") {
    return <Card key={key} className={className || cardSourceClassName} header={slots.header} body={slots.body} footer={slots.footer} />;
  }
  if (node.adapterId === "stack") return <div key={key} className={className || "flex flex-col items-start gap-3"}>{slots.content}</div>;
  if (node.adapterId === "heading") return <h2 key={key} className={className || "text-2xl font-semibold tracking-tight"}>{stringValue(props.children, "Quarterly planning")}</h2>;
  if (node.adapterId === "text") return <p key={key} className={className || "max-w-md text-sm leading-6 text-zinc-400"}>{stringValue(props.children, "Align the product and engineering teams around a review-ready direction.")}</p>;
  if (node.adapterId === "badge") return <span key={key} className={className || "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300"}>{stringValue(props.children, "Ready")}</span>;
  if (node.adapterId === "button") return <button key={key} className={className} type="button">{stringValue(props.children, "Continue")}</button>;
  if (node.adapterId === "input") return <input key={key} className={className} placeholder="Project name" />;
  throw new Error(`Production adapter ${node.adapterId} is unavailable`);
}

function stringValue(value: Value | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
