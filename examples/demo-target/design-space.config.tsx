import type { ComponentAdapter, TargetModule } from "../../src/shared/target-module";
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
        { id: "card.article", tagName: "article" },
        { id: "card.header", tagName: "header" },
        { id: "card.body", tagName: "div" },
      ],
      slots: [
        { id: "header", label: "Header", min: 0, max: 1 },
        { id: "body", label: "Body", min: 0, max: 1 },
        { id: "footer", label: "Footer", min: 0, max: 1 },
      ],
    },
    render: (props, context) => (
      <Card
        className={typeof props.className === "string" ? props.className : cardSourceClassName}
        header={context.slotChildren.header}
        body={context.slotChildren.body}
        footer={context.slotChildren.footer}
      />
    ),
  },
  simpleAdapter("heading", "Heading", "Typography", (props) => (
    <h2 className="text-2xl font-semibold tracking-tight">{stringProp(props, "children", "Quarterly planning")}</h2>
  )),
  simpleAdapter("text", "Text", "Typography", (props) => (
    <p className="max-w-md text-sm leading-6 text-zinc-400">{stringProp(props, "children", "Align the product and engineering teams around a review-ready direction.")}</p>
  )),
  simpleAdapter("badge", "Badge", "Data display", (props) => (
    <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">{stringProp(props, "children", "Ready")}</span>
  )),
  simpleAdapter("button", "Button", "Actions", (props) => (
    <button className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white" type="button">{stringProp(props, "children", "Continue")}</button>
  )),
  simpleAdapter("input", "Input", "Forms", () => (
    <input className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="Project name" />
  )),
  {
    component: {
      id: "stack",
      label: "Stack",
      group: "Layout",
      description: "Vertical layout primitive with an explicit content slot.",
      slots: [{ id: "content", label: "Content" }],
    },
    render: (_props, context) => <div className="flex flex-col items-start gap-3">{context.slotChildren.content}</div>,
  },
];

export const target: TargetModule = {
  project: { id: "demo-target", label: "Design Space demo target" },
  adapters,
  defaultAdapterId: "card",
  defaultProps: { className: cardSourceClassName },
  defaultEditTargetId: "card.surface",
  defaultFixture: {
    instanceId: "review-card",
    adapterId: "card",
    label: "Dashboard",
    slots: {
      header: [{ kind: "component", node: { instanceId: "review-heading", adapterId: "heading", slots: {} } }],
      body: [{
        kind: "component",
        node: {
          instanceId: "review-stack",
          adapterId: "stack",
          slots: {
            content: [
              { kind: "component", node: { instanceId: "review-copy", adapterId: "text", slots: {} } },
              { kind: "component", node: { instanceId: "review-badge", adapterId: "badge", slots: {} } },
            ],
          },
        },
      }],
      footer: [],
    },
  },
  files: [
    { id: "root", label: "demo-target", kind: "directory" },
    { id: "target.config", label: "design-space.config.tsx", kind: "file", parentId: "root" },
    { id: "target.server", label: "design-space.server.ts", kind: "file", parentId: "root" },
    { id: "target.production", label: "vite.production.config.ts", kind: "file", parentId: "root" },
    { id: "src", label: "src", kind: "directory", parentId: "root" },
    { id: "card.source", label: "Card.tsx", kind: "file", parentId: "src" },
    { id: "production.source", label: "production.tsx", kind: "file", parentId: "src" },
  ],
};

function simpleAdapter(
  id: string,
  label: string,
  group: string,
  render: ComponentAdapter["render"],
): ComponentAdapter {
  return { component: { id, label, group, slots: [] }, render };
}

function stringProp(props: Readonly<Record<string, unknown>>, key: string, fallback: string) {
  return typeof props[key] === "string" ? props[key] : fallback;
}
