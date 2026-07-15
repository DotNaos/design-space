import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

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

interface ProductionTemplateContext {
  component: ProductionComponentDocument;
  publicValues: Readonly<Record<string, ProductionValue>>;
  externalSlots: Readonly<Record<string, readonly ProductionChild[]>>;
  externalContext?: ProductionTemplateContext;
  callerAuthoredPath: readonly string[];
}

const dashboard = dashboardSource as ProductionScreenDocument;
const panel = panelSource as ProductionComponentDocument;
const productionClassDefaults: Readonly<Record<string, string>> = {
  card: cardSourceClassName,
  stack: "flex flex-col items-start gap-3",
  heading: "text-2xl font-semibold tracking-tight",
  text: "max-w-md text-sm leading-6 text-zinc-400",
  badge: "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300",
  button: "rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white",
  input: "rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm",
};

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
  templateContext?: ProductionTemplateContext,
): ReactNode {
  const boundProps = resolveBoundProps(node, templateContext);
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
      ...boundProps,
    };
    const nextTemplateContext: ProductionTemplateContext = {
      component,
      publicValues: values,
      externalSlots: node.slots,
      externalContext: templateContext,
      callerAuthoredPath: authoredPath,
    };
    const rendered = renderNode(
      component.root,
      components,
      component.root.instanceId,
      [...authoredPath, node.adapterId],
      nextTemplateContext,
    );
    return instrumentProductionComponent(rendered, component.id, node.instanceId, key);
  }
  const props = { ...node.props, ...boundProps };
  return renderTarget(
    node,
    props,
    renderSlots(node.slots, components, authoredPath, templateContext),
    key,
  );
}

function renderSlots(
  slots: Readonly<Record<string, readonly ProductionChild[]>>,
  components: ReadonlyMap<string, ProductionComponentDocument>,
  authoredPath: readonly string[],
  templateContext?: ProductionTemplateContext,
): Readonly<Record<string, readonly ReactNode[]>> {
  return Object.fromEntries(Object.entries(slots).map(([slotId, children]) => [
    slotId,
    children.flatMap((child, index) => renderChild(
      child,
      `${slotId}-${index}`,
      components,
      authoredPath,
      templateContext,
    )),
  ]));
}

function renderChild(
  child: ProductionChild,
  key: string,
  components: ReadonlyMap<string, ProductionComponentDocument>,
  authoredPath: readonly string[],
  templateContext?: ProductionTemplateContext,
): ReactNode[] {
  if (child.kind === "text") return [<span key={key} style={{ display: "contents" }}>{child.value}</span>];
  if (child.kind === "slot-outlet") {
    if (!templateContext) return [];
    return (templateContext.externalSlots[child.slotId] ?? []).flatMap((external, index) => renderChild(
      external,
      `${key}-${index}`,
      components,
      templateContext.callerAuthoredPath,
      templateContext.externalContext,
    ));
  }
  return [renderNode(child.node, components, key, authoredPath, templateContext)];
}

function instrumentProductionComponent(
  node: ReactNode,
  componentId: string,
  instanceId: string,
  key: string,
): ReactNode {
  const attributes = {
    "data-production-component": componentId,
    "data-production-instance": instanceId,
  };
  if (!isValidElement(node) || node.type === Fragment || typeof node.type !== "string") {
    return <span key={key} {...attributes} style={{ display: "contents" }}>{node}</span>;
  }
  return cloneElement(node as ReactElement<Record<string, unknown>>, { key, ...attributes });
}

function resolveBoundProps(
  node: ProductionNode,
  context: ProductionTemplateContext | undefined,
): Readonly<Record<string, ProductionValue>> {
  if (!context) return {};
  const properties = new Map(context.component.component.properties.map((property) => [property.id, property]));
  return Object.fromEntries(Object.entries(node.propertyBindings ?? {}).flatMap(([targetProp, propertyId]) => {
    const property = properties.get(propertyId);
    if (!property) return [];
    const value = context.publicValues[property.prop];
    return value === undefined ? [] : [[targetProp, value]];
  }));
}

function renderTarget(
  node: ProductionNode,
  props: Readonly<Record<string, ProductionValue>>,
  slots: Readonly<Record<string, readonly ReactNode[]>>,
  key: string,
): ReactNode {
  const className = classValue(props.className, productionClassDefaults[node.adapterId] ?? "");
  if (node.adapterId === "card") {
    return <Card key={key} className={className} header={slots.header} body={slots.body} footer={slots.footer} />;
  }
  if (node.adapterId === "stack") return <div key={key} className={className}>{slots.content}</div>;
  if (node.adapterId === "heading") return <h2 key={key} className={className}>{stringValue(props.children, "Quarterly planning")}</h2>;
  if (node.adapterId === "text") return <p key={key} className={className}>{stringValue(props.children, "Align the product and engineering teams around a review-ready direction.")}</p>;
  if (node.adapterId === "badge") return <span key={key} className={className}>{stringValue(props.children, "Ready")}</span>;
  if (node.adapterId === "button") return <button key={key} className={className} type="button">{stringValue(props.children, "Continue")}</button>;
  if (node.adapterId === "input") return <input key={key} className={className} placeholder="Project name" />;
  throw new Error(`Production adapter ${node.adapterId} is unavailable`);
}

function stringValue(value: ProductionValue | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function classValue(value: ProductionValue | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return typeof value === "string" ? value : "";
}
