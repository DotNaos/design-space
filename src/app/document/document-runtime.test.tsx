import { render, screen } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { DesignDocumentPreview, renderDesignDocument } from "./document-runtime";

const target: TargetModule = {
  project: { id: "demo", label: "Demo" },
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "root", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [
    {
      component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
      controls: [{ id: "surface", label: "Surface", kind: "tailwind", prop: "className" }],
      render: (props, context) => <div {...context.previewAttributes} className={String(props.className ?? "")}>{context.slotChildren.content}</div>,
    },
    {
      component: { id: "text", label: "Text", group: "Content", slots: [] },
      controls: [{ id: "content", label: "Content", kind: "text", prop: "children" }],
      render: (props, context) => <p {...context.previewAttributes}>{String(props.children ?? "")}</p>,
    },
    {
      component: { id: "fragment", label: "Fragment", group: "Content", slots: [] },
      render: () => <><strong>First</strong><em>Second</em></>,
    },
  ],
};

const panel: DesignDocument = {
  schemaVersion: 2,
  id: "component.panel",
  label: "Panel",
  kind: "component",
  component: {
    id: "panel",
    label: "Panel",
    group: "Surfaces",
    properties: [{ id: "title", label: "Title", prop: "children", kind: "text", defaultValue: "Default" }],
    slots: [{ id: "body", label: "Body" }],
  },
  root: {
    instanceId: "panel.template",
    adapterId: "stack",
    slots: { content: [{ kind: "slot-outlet", id: "panel.body.outlet", slotId: "body" }] },
  },
};

it("executes target adapters directly and expands authored component slot outlets", () => {
  const document: DesignDocument = {
    schemaVersion: 2,
    id: "screen.main",
    label: "Main",
    kind: "screen",
    root: {
      instanceId: "panel.one",
      adapterId: "panel",
      slots: {
        body: [{ kind: "component", node: { instanceId: "copy.one", adapterId: "text", props: { children: "Hello" }, slots: {} } }],
      },
    },
  };
  render(<>{renderDesignDocument(target, document, [panel])}</>);
  expect(screen.getByText("Hello")).toBeInTheDocument();
  expect(screen.getByText("Hello")).toHaveAttribute("data-design-space-instance-id", "copy.one");
  expect(globalThis.document.querySelector('[data-design-space-outlet-id="panel.one--panel.body.outlet"]'))
    .toHaveAttribute("data-design-space-slot-id", "slot:panel.one:body");
});

it("runs direct React adapters inside the target-owned preview root", () => {
  const TargetThemeContext = createContext("missing-target-context");
  function ContextConsumer() {
    return <span>{useContext(TargetThemeContext)}</span>;
  }
  const contextualTarget: TargetModule = {
    ...target,
    previewRoot: ({ children }: { children: ReactNode }) => (
      <TargetThemeContext.Provider value="external-target-theme">
        {children}
      </TargetThemeContext.Provider>
    ),
    adapters: [
      ...target.adapters,
      {
        component: { id: "context-consumer", label: "Context consumer", group: "Content", slots: [] },
        render: (_props, context) => (
          <div {...context.previewAttributes}>
            <ContextConsumer />
          </div>
        ),
      },
    ],
  };
  const document: DesignDocument = {
    schemaVersion: 2,
    id: "screen.context",
    label: "Context",
    kind: "screen",
    root: { instanceId: "context.one", adapterId: "context-consumer", slots: {} },
  };

  render(<DesignDocumentPreview target={contextualTarget} document={document} library={[]} />);

  expect(screen.getByText("external-target-theme").closest("div")).toHaveAttribute(
    "data-design-space-instance-id",
    "context.one",
  );
});

it("anchors explicit outlets in component documents", () => {
  render(<>{renderDesignDocument(target, panel, [panel])}</>);

  expect(document.querySelector('[data-design-space-outlet-id="panel.body.outlet"]'))
    .toHaveAttribute("data-design-space-slot-id", "slot:panel.template:content");
});

it("applies a public property only to its explicitly bound implementation control", () => {
  const boundPanel: DesignDocument = {
    ...panel,
    component: {
      ...panel.component!,
      properties: [{ id: "title", label: "Title", prop: "title", kind: "text", defaultValue: "Default title" }],
      slots: [],
    },
    root: {
      instanceId: "panel.template",
      adapterId: "stack",
      props: { className: "root-surface" },
      slots: {
        content: [
          { kind: "component", node: { instanceId: "bound.copy", adapterId: "text", propertyBindings: { children: "title" }, slots: {} } },
          { kind: "component", node: { instanceId: "static.copy", adapterId: "text", props: { children: "Static sibling" }, slots: {} } },
        ],
      },
    },
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.bound",
    label: "Bound",
    kind: "screen",
    root: { instanceId: "panel.bound", adapterId: "panel", props: { title: "Bound title" }, slots: {} },
  };

  render(<>{renderDesignDocument(target, screenDocument, [boundPanel])}</>);

  expect(screen.getByText("Bound title")).toHaveAttribute("data-design-space-instance-id", "panel.bound--bound.copy");
  expect(screen.getByText("Static sibling")).toHaveAttribute("data-design-space-instance-id", "panel.bound--static.copy");
  expect(screen.getByText("Bound title").closest("div")).toHaveClass("root-surface");
});

it("scopes authored component internals per outer instance", () => {
  const nestedPanel: DesignDocument = {
    ...panel,
    root: {
      ...panel.root,
      slots: {
        content: [
          { kind: "component", node: { instanceId: "internal.copy", adapterId: "text", props: { children: "Internal" }, slots: {} } },
          ...panel.root.slots.content,
        ],
      },
    },
  };
  const documentWithTwoPanels: DesignDocument = {
    schemaVersion: 2,
    id: "screen.two-panels",
    label: "Two panels",
    kind: "screen",
    root: {
      instanceId: "screen.root",
      adapterId: "stack",
      slots: {
        content: [
          { kind: "component", node: { instanceId: "panel.one", adapterId: "panel", slots: { body: [] } } },
          { kind: "component", node: { instanceId: "panel.two", adapterId: "panel", slots: { body: [] } } },
        ],
      },
    },
  };

  render(<>{renderDesignDocument(target, documentWithTwoPanels, [nestedPanel])}</>);

  expect([...document.querySelectorAll('[data-design-space-instance-id$="--internal.copy"]')].map((element) => element.getAttribute("data-design-space-instance-id"))).toEqual([
    "panel.one--internal.copy",
    "panel.two--internal.copy",
  ]);
});

it("instruments fragment adapters without changing their layout box", () => {
  const fragmentDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.fragment",
    label: "Fragment",
    kind: "screen",
    root: { instanceId: "fragment.one", adapterId: "fragment", slots: {} },
  };

  render(<>{renderDesignDocument(target, fragmentDocument, [])}</>);

  const anchor = document.querySelector('[data-design-space-instance-id="fragment.one"]');
  expect(anchor).toHaveStyle({ display: "contents" });
  expect(anchor).toContainElement(screen.getByText("First"));
  expect(anchor).toContainElement(screen.getByText("Second"));
});

it("stops authored component cycles with a recoverable error instead of overflowing the stack", () => {
  const recursive: DesignDocument = {
    ...panel,
    root: { instanceId: "panel.template", adapterId: "panel", slots: { body: [] } },
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.recursive",
    label: "Recursive",
    kind: "screen",
    root: { instanceId: "panel.one", adapterId: "panel", slots: { body: [] } },
  };

  expect(() => renderDesignDocument(target, screenDocument, [recursive])).toThrow("Recursive authored component: panel → panel");
});
