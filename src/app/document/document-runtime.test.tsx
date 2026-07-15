import { fireEvent, render, screen } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { PreviewCanvas } from "../components/PreviewCanvas";
import { indexPreviewDom } from "../dom/dom-snapshot";
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
    .toHaveAttribute("data-design-space-slot-id", "slot:panel.template:body");
});

it.each([
  ["a public class default", "bg-public", "bg-public"],
  ["an explicitly empty public class", "", ""],
  ["an explicitly null public class", null, ""],
])("renders a component document with %s exactly like a later instance", (_label, defaultValue, expectedClass) => {
  const componentDocument: DesignDocument = {
    schemaVersion: 2,
    id: "component.surface",
    label: "Surface",
    kind: "component",
    component: {
      id: "surface",
      label: "Surface",
      group: "Custom",
      properties: [{
        id: "surface.class",
        label: "Class",
        prop: "surface",
        kind: "tailwind",
        defaultValue,
      }],
      slots: [],
    },
    root: {
      instanceId: "surface.template",
      adapterId: "stack",
      props: { className: "implementation-class" },
      propertyBindings: { className: "surface.class" },
      slots: { content: [] },
    },
  };
  const targetWithDefault: TargetModule = {
    ...target,
    adapters: target.adapters.map((adapter) => adapter.component.id === "stack"
      ? { ...adapter, defaultProps: { className: "adapter-default" } }
      : adapter),
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.surface",
    label: "Surface screen",
    kind: "screen",
    root: { instanceId: "surface.instance", adapterId: "surface", slots: {} },
  };

  const workshop = render(<>{renderDesignDocument(targetWithDefault, componentDocument, [componentDocument])}</>);
  expect(workshop.container.firstElementChild).toHaveAttribute("class", expectedClass);
  workshop.unmount();
  const placed = render(<>{renderDesignDocument(targetWithDefault, screenDocument, [componentDocument])}</>);
  expect(placed.container.firstElementChild).toHaveAttribute("class", expectedClass);
});

it("applies a public property and maps implementation clicks to the public authored instance", () => {
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

  const workshop = render(<>{renderDesignDocument(target, boundPanel, [boundPanel])}</>);
  expect(screen.getByText("Default title")).toHaveAttribute("data-design-space-instance-id", "bound.copy");
  expect(screen.getByText("Static sibling")).toHaveAttribute("data-design-space-instance-id", "static.copy");
  workshop.unmount();

  const onSelect = vi.fn();
  render(
    <PreviewCanvas
      compact
      preview={renderDesignDocument(target, screenDocument, [boundPanel])}
      rootInstanceId="panel.bound"
      selectedComponentInstanceId="panel.bound"
      selection={{ kind: "component", id: "panel.bound" }}
      selectionLabel="Panel"
      slots={[]}
      onSelect={onSelect}
    />,
  );

  expect(screen.getByText("Bound title")).toHaveAttribute("data-design-space-instance-id", "panel.bound");
  expect(screen.getByText("Static sibling")).toHaveAttribute("data-design-space-instance-id", "panel.bound");
  expect(document.querySelector('[data-design-space-instance-id^="panel.bound--"]')).not.toBeInTheDocument();
  expect(screen.getByText("Bound title").closest("div")).toHaveClass("root-surface");
  fireEvent.click(screen.getByText("Static sibling"));
  expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "panel.bound" });
});

it("maps authored component internals to each outer public instance", () => {
  const nestedPanel: DesignDocument = {
    ...panel,
    root: {
      ...panel.root!,
      slots: {
        content: [
          { kind: "component", node: { instanceId: "internal.copy", adapterId: "text", props: { children: "Internal" }, slots: {} } },
          ...panel.root!.slots.content,
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

  expect(screen.getAllByText("Internal").map((element) => element.getAttribute("data-design-space-instance-id")))
    .toEqual(["panel.one", "panel.two"]);
  expect(document.querySelector('[data-design-space-instance-id$="--internal.copy"]')).not.toBeInTheDocument();
});

it("keeps sibling implementation slot and HTML evidence uniquely scoped behind the public boundary", () => {
  const targetWithBoxes: TargetModule = {
    ...target,
    adapters: [...target.adapters, {
      component: {
        id: "box",
        label: "Box",
        group: "Layout",
        slots: [{ id: "content", label: "Content" }],
        internalHtml: [{ id: "surface", tagName: "header" }],
      },
      render: (props, context) => (
        <section {...context.previewAttributes}>
          <header {...context.htmlAttributes.surface}>{String(props.label)}</header>
          <div {...context.slotAttributes.content}>{context.slotChildren.content}</div>
        </section>
      ),
    }],
  };
  const boxedPanel: DesignDocument = {
    ...panel,
    root: {
      ...panel.root!,
      slots: { content: [
        { kind: "component", node: { instanceId: "box.one", adapterId: "box", props: { label: "First box" }, htmlClassNames: { surface: "rounded-xl p-6" }, slots: { content: [] } } },
        { kind: "component", node: { instanceId: "box.two", adapterId: "box", props: { label: "Second box" }, slots: { content: [] } } },
        ...panel.root!.slots.content,
      ] },
    },
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.boxes",
    label: "Boxes",
    kind: "screen",
    root: {
      instanceId: "panel.boxes",
      adapterId: "panel",
      slots: { body: [{ kind: "component", node: { instanceId: "copy.external", adapterId: "text", props: { children: "Projected" }, slots: {} } }] },
    },
  };

  const workshop = render(<>{renderDesignDocument(targetWithBoxes, boxedPanel, [boxedPanel])}</>);
  expect(screen.getByText("First box")).toHaveAttribute("data-design-space-html-id", "html:box.one:surface");
  expect(screen.getByText("First box")).toHaveClass("rounded-xl", "p-6");
  expect(workshop.container.querySelector('[data-design-space-slot-id="slot:box.two:content"]')).toBeInTheDocument();
  workshop.unmount();

  const { container } = render(<>{renderDesignDocument(targetWithBoxes, screenDocument, [boxedPanel])}</>);
  expect(screen.getAllByText(/box$/).map((element) => element.closest("section")?.dataset.designSpaceInstanceId))
    .toEqual(["panel.boxes", "panel.boxes"]);
  expect(screen.getByText("First box")).toHaveAttribute("data-design-space-html-id", "html:panel.boxes--box.one:surface");
  expect(screen.getByText("Second box")).toHaveAttribute("data-design-space-html-id", "html:panel.boxes--box.two:surface");
  expect(container.querySelector('[data-design-space-slot-id="slot:panel.boxes--box.one:content"]')).toBeInTheDocument();
  expect(container.querySelector('[data-design-space-slot-id="slot:panel.boxes--box.two:content"]')).toBeInTheDocument();
  expect(container.querySelector('[data-design-space-slot-id="slot:panel.boxes:content"]')).not.toBeInTheDocument();
  expect(container.querySelector('[data-design-space-outlet-id="panel.boxes--panel.body.outlet"]'))
    .toHaveAttribute("data-design-space-slot-id", "slot:panel.boxes:body");
  expect(screen.getByText("Projected")).toHaveAttribute("data-design-space-instance-id", "copy.external");

  const snapshot = indexPreviewDom(container);
  const snapshotIds = collectSnapshotIds(snapshot["panel.boxes"]);
  expect(new Set(snapshotIds).size).toBe(snapshotIds.length);
  const indexedHtmlIds = [...container.querySelectorAll<HTMLElement>('[data-design-space-html-id^="html:panel.boxes:"]')]
    .map((element) => element.dataset.designSpaceHtmlId);
  expect(new Set(indexedHtmlIds).size).toBe(indexedHtmlIds.length);
  expect(indexedHtmlIds).not.toContain("html:panel.boxes:surface");
});

it("keeps the outer public instance evidence when an implementation root is authored", () => {
  const inner: DesignDocument = {
    schemaVersion: 2,
    id: "component.inner",
    label: "Inner",
    kind: "component",
    component: { id: "inner", label: "Inner", group: "Custom", properties: [], slots: [] },
    root: {
      instanceId: "inner.root",
      adapterId: "stack",
      slots: {
        content: [{
          kind: "component",
          node: { instanceId: "inner.copy", adapterId: "text", props: { children: "Nested implementation" }, slots: {} },
        }],
      },
    },
  };
  const outer: DesignDocument = {
    schemaVersion: 2,
    id: "component.outer",
    label: "Outer",
    kind: "component",
    component: { id: "outer", label: "Outer", group: "Custom", properties: [], slots: [] },
    root: { instanceId: "outer.inner", adapterId: "inner", slots: {} },
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.outer",
    label: "Outer screen",
    kind: "screen",
    root: { instanceId: "outer.instance", adapterId: "outer", slots: {} },
  };

  const { container } = render(<>{renderDesignDocument(target, screenDocument, [outer, inner])}</>);

  expect(container.firstElementChild).toHaveAttribute("data-design-space-instance-id", "outer.instance");
  expect(container.querySelector('[data-design-space-instance-id="outer.instance--outer.inner"]')).not.toBeInTheDocument();
  expect(screen.getByText("Nested implementation")).toHaveAttribute("data-design-space-instance-id", "outer.instance");
  expect(container.querySelector('[data-design-space-instance-id$="--inner.copy"]')).not.toBeInTheDocument();
});

it("allows a finite instance of a component inside its own projected slot", () => {
  const recursiveBySlot: DesignDocument = {
    schemaVersion: 2,
    id: "component.slot-container",
    label: "Slot container",
    kind: "component",
    component: {
      id: "slot-container",
      label: "Slot container",
      group: "Custom",
      properties: [],
      slots: [{ id: "content", label: "Content" }],
    },
    root: {
      instanceId: "slot-container.root",
      adapterId: "stack",
      slots: { content: [{ kind: "slot-outlet", id: "slot-container.outlet", slotId: "content" }] },
    },
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.finite-recursion",
    label: "Finite recursion",
    kind: "screen",
    root: {
      instanceId: "slot-container.outer",
      adapterId: "slot-container",
      slots: {
        content: [{
          kind: "component",
          node: { instanceId: "slot-container.inner", adapterId: "slot-container", slots: { content: [] } },
        }],
      },
    },
  };

  const { container } = render(<>{renderDesignDocument(target, screenDocument, [recursiveBySlot])}</>);

  expect(container.querySelector('[data-design-space-instance-id="slot-container.outer"]')).toBeInTheDocument();
  expect(container.querySelector('[data-design-space-instance-id="slot-container.inner"]')).toBeInTheDocument();
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
  const forwarder: DesignDocument = {
    schemaVersion: 2,
    id: "component.forwarder",
    label: "Forwarder",
    kind: "component",
    component: {
      id: "forwarder",
      label: "Forwarder",
      group: "Custom",
      properties: [],
      slots: [{ id: "content", label: "Content" }],
    },
    root: {
      instanceId: "forwarder.root",
      adapterId: "stack",
      slots: { content: [{ kind: "slot-outlet", id: "forwarder.outlet", slotId: "content" }] },
    },
  };
  const recursive: DesignDocument = {
    schemaVersion: 2,
    id: "component.recursive",
    label: "Recursive",
    kind: "component",
    component: { id: "recursive", label: "Recursive", group: "Custom", properties: [], slots: [] },
    root: {
      instanceId: "recursive.forwarder",
      adapterId: "forwarder",
      slots: {
        content: [{
          kind: "component",
          node: { instanceId: "recursive.again", adapterId: "recursive", slots: {} },
        }],
      },
    },
  };
  const screenDocument: DesignDocument = {
    schemaVersion: 2,
    id: "screen.recursive",
    label: "Recursive",
    kind: "screen",
    root: { instanceId: "recursive.instance", adapterId: "recursive", slots: {} },
  };

  expect(() => renderDesignDocument(target, screenDocument, [recursive, forwarder]))
    .toThrow("Recursive authored component: recursive → recursive");
});

interface SnapshotNode {
  id: string;
  children?: readonly SnapshotNode[];
}

function collectSnapshotIds(nodes: readonly SnapshotNode[] | undefined): string[] {
  return (nodes ?? []).flatMap((node) => [node.id, ...collectSnapshotIds(node.children)]);
}
