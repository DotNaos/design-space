import type { ReactNode } from "react";

import dashboardSource from "./dashboard.design.json";
import panelSource from "./panel.design.json";
import { Card, cardSourceClassName } from "./Card";

export type ProductionValue = string | number | boolean | null;
export type ProductionChild =
  | { kind: "text"; id: string; value: string }
  | { kind: "slot-outlet"; id: string; slotId: string }
  | { kind: "component"; node: ProductionNode };
export type ProductionNode = {
  instanceId: string;
  adapterId: string;
  props?: Record<string, ProductionValue>;
  propertyBindings?: Record<string, string>;
  slots: Record<string, ProductionChild[]>;
};
export type ProductionComponentDocument = {
  id: string;
  component: {
    id: string;
    properties: Array<{ id: string; prop: string; defaultValue?: ProductionValue }>;
  };
  root: ProductionNode;
};
export type ProductionScreenDocument = { id: string; root: ProductionNode };

const dashboard = dashboardSource as ProductionScreenDocument;
const panel = panelSource as ProductionComponentDocument;

export function ProductionApp() {
  return (
    <main data-production-document={dashboard.id} className="min-h-screen bg-zinc-900 p-6">
      {renderProductionDocument(dashboard, [panel])}
    </main>
  );
}

export function renderProductionDocument(
  document: ProductionScreenDocument,
  componentDocuments: readonly ProductionComponentDocument[],
): ReactNode {
  const components = new Map(componentDocuments.map((component) => [component.component.id, component]));
  return renderNode(document.root, components);
}

function renderNode(
  node: ProductionNode,
  components: ReadonlyMap<string, ProductionComponentDocument>,
  key: string = node.instanceId,
  authoredPath: readonly string[] = [],
): ReactNode {
  const component = components.get(node.adapterId);
  if (component) {
    if (authoredPath.includes(node.adapterId)) {
      throw new Error(`Recursive production component: ${[...authoredPath, node.adapterId].join(" -> ")}`);
    }
    const values = {
      ...Object.fromEntries(component.component.properties.flatMap((property) => (
        property.defaultValue === undefined ? [] : [[property.prop, property.defaultValue]]
      ))),
      ...node.props,
    };
    return (
      <div key={key} data-production-component={component.id} data-production-instance={node.instanceId}>
        {renderTemplate(
          component.root,
          component,
          values,
          node.slots,
          components,
          [...authoredPath, node.adapterId],
        )}
      </div>
    );
  }
  return renderTarget(node, node.props ?? {}, renderSlots(node.slots, components, authoredPath), key);
}

function renderTemplate(
  node: ProductionNode,
  component: ProductionComponentDocument,
  publicValues: Readonly<Record<string, ProductionValue>>,
  externalSlots: Readonly<Record<string, readonly ProductionChild[]>>,
  components: ReadonlyMap<string, ProductionComponentDocument>,
  authoredPath: readonly string[],
): ReactNode {
  const properties = new Map(component.component.properties.map((property) => [property.id, property]));
  const bound = Object.fromEntries(Object.entries(node.propertyBindings ?? {}).flatMap(([targetProp, propertyId]) => {
    const property = properties.get(propertyId);
    const value = property ? publicValues[property.prop] : undefined;
    return value === undefined ? [] : [[targetProp, value]];
  }));
  const props = { ...node.props, ...bound };
  if (components.has(node.adapterId)) {
    return renderNode({ ...node, props }, components, node.instanceId, authoredPath);
  }
  const slots = Object.fromEntries(Object.entries(node.slots).map(([slotId, children]) => [
    slotId,
    children.flatMap((child) => child.kind === "slot-outlet"
      ? (externalSlots[child.slotId] ?? []).map((external, index) => renderChild(
          external,
          `${child.id}-${index}`,
          components,
          authoredPath,
        ))
      : [child.kind === "component"
          ? renderTemplate(child.node, component, publicValues, externalSlots, components, authoredPath)
          : renderChild(child, child.id, components, authoredPath)]),
  ]));
  return renderTarget(node, props, slots, node.instanceId);
}

function renderSlots(
  slots: Readonly<Record<string, readonly ProductionChild[]>>,
  components: ReadonlyMap<string, ProductionComponentDocument>,
  authoredPath: readonly string[],
): Readonly<Record<string, readonly ReactNode[]>> {
  return Object.fromEntries(Object.entries(slots).map(([slotId, children]) => [
    slotId,
    children.map((child, index) => renderChild(child, `${slotId}-${index}`, components, authoredPath)),
  ]));
}

function renderChild(
  child: ProductionChild,
  key: string,
  components: ReadonlyMap<string, ProductionComponentDocument>,
  authoredPath: readonly string[],
): ReactNode {
  if (child.kind === "text") return <span key={key}>{child.value}</span>;
  if (child.kind === "slot-outlet") return null;
  return renderNode(child.node, components, key, authoredPath);
}

function renderTarget(
  node: ProductionNode,
  props: Readonly<Record<string, ProductionValue>>,
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

function stringValue(value: ProductionValue | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
