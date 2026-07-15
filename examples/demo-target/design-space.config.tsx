import type { ComponentAdapter, ComponentFixture, TargetModule } from "../../src/shared/target-module";
import { Card, cardSourceClassName } from "./src/Card";

const adapters: ComponentAdapter[] = [
  {
    component: {
      id: "card",
      label: "Card",
      group: "Surfaces",
      description: "A composed surface with three explicit child slots.",
      sourceFileId: "card.source",
      internalHtml: [
        { id: "card.article", tagName: "article", children: [
          { id: "card.header", tagName: "header" },
          { id: "card.body", tagName: "div" },
          { id: "card.footer", tagName: "footer" },
        ] },
      ],
      slots: [
        { id: "header", label: "Header", min: 0, max: 1, accepts: ["heading"], acceptsText: false },
        { id: "body", label: "Body", min: 0, max: 1, accepts: ["stack", "text"], acceptsText: false },
        { id: "footer", label: "Footer", min: 0, max: 1, accepts: ["badge", "button"], acceptsText: false },
      ],
    },
    controls: [{ id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" }],
    defaultProps: { className: cardSourceClassName },
    render: (props, context) => (
      <Card
        className={stringProp(props, "className", "")}
        header={context.slotChildren.header}
        body={context.slotChildren.body}
        footer={context.slotChildren.footer}
        previewAttributes={context.previewAttributes}
        slotAttributes={context.slotAttributes}
        htmlAttributes={context.htmlAttributes}
      />
    ),
  },
  simpleAdapter("heading", "Heading", "Typography", {
    className: "text-2xl font-semibold tracking-tight",
    children: "Quarterly planning",
  }, (props) => (
    <h2 className={stringProp(props, "className", "")}>{stringProp(props, "children", "Quarterly planning")}</h2>
  )),
  simpleAdapter("text", "Text", "Typography", {
    className: "max-w-md text-sm leading-6 text-zinc-400",
    children: "Align the product and engineering teams around a review-ready direction.",
  }, (props) => (
    <p className={stringProp(props, "className", "")}>{stringProp(props, "children", "")}</p>
  )),
  simpleAdapter("badge", "Badge", "Data display", {
    className: "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300",
    children: "Ready",
  }, (props) => (
    <span className={stringProp(props, "className", "")}>{stringProp(props, "children", "Ready")}</span>
  )),
  simpleAdapter("button", "Button", "Actions", {
    className: "rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white",
    children: "Continue",
  }, (props) => (
    <button className={stringProp(props, "className", "")} type="button">{stringProp(props, "children", "Continue")}</button>
  )),
  simpleAdapter("input", "Input", "Forms", {
    className: "rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm",
  }, (props) => (
    <input className={stringProp(props, "className", "")} placeholder="Project name" />
  )),
  {
    component: {
      id: "app-layout",
      label: "App layout",
      group: "Layout",
      description: "A strict two-region application shell.",
      slots: [
        { id: "sidebar", label: "Sidebar", min: 1, max: 1, accepts: ["sidebar"], acceptsText: false },
        { id: "main", label: "Main", min: 1, max: 1, accepts: ["main"], acceptsText: false },
      ],
    },
    controls: [{ id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" }],
    defaultProps: { className: "grid min-h-96 grid-cols-[14rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10" },
    render: (props, context) => (
      <div {...context.previewAttributes} className={stringProp(props, "className", "")}>
        <div {...context.slotAttributes.sidebar}>{context.slotChildren.sidebar}</div>
        <div {...context.slotAttributes.main}>{context.slotChildren.main}</div>
      </div>
    ),
  },
  slotAdapter(
    "sidebar",
    "Sidebar",
    "Layout",
    "flex min-h-96 flex-col gap-3 border-r border-white/10 bg-white/[0.03] p-4",
    { id: "content", label: "Content", accepts: ["heading", "text", "badge", "button"], acceptsText: false },
  ),
  slotAdapter(
    "main",
    "Main container",
    "Layout",
    "flex min-h-96 min-w-0 flex-col gap-4 p-6",
    { id: "content", label: "Content", accepts: ["heading", "text", "badge", "button", "input", "card", "stack", "panel"], acceptsText: false },
  ),
  {
    component: {
      id: "stack",
      label: "Stack",
      group: "Layout",
      description: "Vertical layout primitive with an explicit content slot.",
      slots: [{ id: "content", label: "Content", accepts: ["heading", "text", "badge", "button", "input", "card", "panel"], acceptsText: false }],
    },
    controls: [{ id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" }],
    defaultProps: { className: "flex flex-col items-start gap-3" },
    render: (props, context) => <div {...context.slotAttributes.content} className={stringProp(props, "className", "")}>{context.slotChildren.content}</div>,
  },
];

const targetOnlyFallbackFixture: ComponentFixture = {
  instanceId: "fallback-card",
  adapterId: "card",
  props: { className: cardSourceClassName },
  slots: {
    header: [{ kind: "component", node: { instanceId: "fallback-heading", adapterId: "heading", slots: {} } }],
    body: [{ kind: "component", node: { instanceId: "fallback-copy", adapterId: "text", slots: {} } }],
    footer: [],
  },
};

export const target: TargetModule = {
  project: { id: "demo-target", label: "Design Space demo target" },
  adapters,
  defaultAdapterId: "card",
  defaultDocumentId: "screen.dashboard",
  defaultDocumentLabel: "Dashboard",
  documents: [
    { id: "screen.dashboard", label: "Dashboard", kind: "screen" },
    { id: "component.panel", label: "Panel", kind: "component", group: "Surfaces" },
  ],
  componentRecipes: [
    {
      id: "stack-component",
      label: "Stack component",
      description: "Start with a target-owned Stack and place explicit slot outlets inside it.",
      rootAdapterId: "stack",
      rootSlotId: "content",
    },
  ],
  defaultProps: { className: cardSourceClassName },
  defaultEditTargetId: "card.surface",
  defaultFixture: targetOnlyFallbackFixture,
  files: [
    { id: "root", label: "demo-target", kind: "directory" },
    { id: "target.config", label: "design-space.config.tsx", kind: "file", parentId: "root" },
    { id: "target.server", label: "design-space.server.ts", kind: "file", parentId: "root" },
    { id: "target.production", label: "vite.production.config.ts", kind: "file", parentId: "root" },
    { id: "src", label: "src", kind: "directory", parentId: "root" },
    { id: "card.source", label: "Card.tsx", kind: "file", parentId: "src" },
    { id: "tailwind.theme", label: "theme.css", kind: "file", parentId: "src" },
    { id: "dashboard.document", label: "dashboard.design.json", kind: "file", parentId: "src" },
    { id: "panel.document", label: "panel.design.json", kind: "file", parentId: "src" },
    { id: "production.source", label: "production.tsx", kind: "file", parentId: "src" },
  ],
};

function simpleAdapter(
  id: string,
  label: string,
  group: string,
  defaultProps: Readonly<Record<string, unknown>>,
  render: ComponentAdapter["render"],
): ComponentAdapter {
  return {
    component: { id, label, group, slots: [] },
    controls: [
      { id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" },
      ...(typeof defaultProps.children === "string"
        ? [{ id: "content", label: "Content", kind: "text" as const, prop: "children" }]
        : []),
    ],
    defaultProps,
    render,
  };
}

function slotAdapter(
  id: string,
  label: string,
  group: string,
  className: string,
  slot: ComponentAdapter["component"]["slots"][number],
): ComponentAdapter {
  return {
    component: { id, label, group, slots: [slot] },
    controls: [{ id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" }],
    defaultProps: { className },
    render: (props, context) => (
      <div {...context.previewAttributes} {...context.slotAttributes[slot.id]} className={stringProp(props, "className", className)}>
        {context.slotChildren[slot.id]}
      </div>
    ),
  };
}

function stringProp(props: Readonly<Record<string, unknown>>, key: string, fallback: string) {
  return typeof props[key] === "string" ? props[key] : fallback;
}
