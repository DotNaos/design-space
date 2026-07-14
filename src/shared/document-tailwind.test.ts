import { expect, it } from "vitest";

import type { DesignDocument } from "./design-document";
import { collectDocumentTailwind } from "./document-tailwind";
import type { TargetModule } from "./target-module";

const target: TargetModule = {
  project: { id: "tailwind-graph", label: "Tailwind graph" },
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "stack.one", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [{
    component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
    controls: [{ id: "surface", label: "Surface", kind: "tailwind", prop: "className" }],
    render: () => null,
  }],
};

it("collects and deduplicates Tailwind from authored templates, bindings, and projected children", () => {
  const panel: DesignDocument = {
    schemaVersion: 2,
    id: "component.panel",
    label: "Panel",
    kind: "component",
    component: {
      id: "panel",
      label: "Panel",
      group: "Custom",
      properties: [{ id: "surface", label: "Surface", prop: "surface", kind: "tailwind", defaultValue: "p-2" }],
      slots: [{ id: "body", label: "Body" }],
    },
    root: {
      instanceId: "panel.root",
      adapterId: "stack",
      props: { className: "rounded-xl" },
      propertyBindings: { className: "surface" },
      slots: { content: [{ kind: "slot-outlet", id: "panel.outlet", slotId: "body" }] },
    },
  };
  const screen: DesignDocument = {
    schemaVersion: 2,
    id: "screen.home",
    label: "Home",
    kind: "screen",
    root: {
      instanceId: "screen.root",
      adapterId: "stack",
      props: { className: "p-2 gap-4" },
      slots: {
        content: [{
          kind: "component",
          node: {
            instanceId: "panel.one",
            adapterId: "panel",
            props: { surface: "p-6 rounded-xl" },
            slots: {
              body: [{ kind: "component", node: { instanceId: "projected", adapterId: "stack", props: { className: "gap-4 mt-2" }, slots: { content: [] } } }],
            },
          },
        }],
      },
    },
  };

  expect(collectDocumentTailwind(target, [panel], screen.root)).toBe("p-2 gap-4 p-6 rounded-xl mt-2");
});

it("passes an outer authored binding through a nested authored component template", () => {
  const inner: DesignDocument = {
    schemaVersion: 2,
    id: "component.inner",
    label: "Inner",
    kind: "component",
    component: {
      id: "inner",
      label: "Inner",
      group: "Custom",
      properties: [{
        id: "inner-surface",
        label: "Inner surface",
        prop: "surface",
        kind: "tailwind",
        defaultValue: "bg-inner-default",
      }],
      slots: [],
    },
    root: {
      instanceId: "inner.root",
      adapterId: "stack",
      propertyBindings: { className: "inner-surface" },
      slots: { content: [] },
    },
  };
  const outer: DesignDocument = {
    schemaVersion: 2,
    id: "component.outer",
    label: "Outer",
    kind: "component",
    component: {
      id: "outer",
      label: "Outer",
      group: "Custom",
      properties: [{
        id: "outer-surface",
        label: "Outer surface",
        prop: "surface",
        kind: "tailwind",
        defaultValue: "bg-outer-default",
      }],
      slots: [],
    },
    root: {
      instanceId: "outer.root",
      adapterId: "stack",
      props: { className: "p-4" },
      slots: {
        content: [{
          kind: "component",
          node: {
            instanceId: "outer.inner",
            adapterId: "inner",
            propertyBindings: { surface: "outer-surface" },
            slots: {},
          },
        }],
      },
    },
  };
  const screen: DesignDocument = {
    schemaVersion: 2,
    id: "screen.nested",
    label: "Nested",
    kind: "screen",
    root: {
      instanceId: "screen.outer",
      adapterId: "outer",
      props: { surface: "bg-cyan-500" },
      slots: {},
    },
  };

  expect(collectDocumentTailwind(target, [outer, inner], screen.root)).toBe("bg-cyan-500 p-4");
});

it("keeps implementation and adapter Tailwind when an optional binding is unset", () => {
  const panel = (className?: string): DesignDocument => ({
    schemaVersion: 2,
    id: "component.optional-panel",
    label: "Optional panel",
    kind: "component",
    component: {
      id: "optional-panel",
      label: "Optional panel",
      group: "Custom",
      properties: [{ id: "surface", label: "Surface", prop: "surface", kind: "tailwind" }],
      slots: [],
    },
    root: {
      instanceId: "optional-panel.root",
      adapterId: "stack",
      ...(className ? { props: { className } } : {}),
      propertyBindings: { className: "surface" },
      slots: { content: [] },
    },
  });
  const screen: DesignDocument = {
    schemaVersion: 2,
    id: "screen.optional-panel",
    label: "Optional panel",
    kind: "screen",
    root: { instanceId: "optional-panel.instance", adapterId: "optional-panel", slots: {} },
  };
  const targetWithDefault: TargetModule = {
    ...target,
    adapters: target.adapters.map((adapter) => ({ ...adapter, defaultProps: { className: "p-4" } })),
  };

  expect(collectDocumentTailwind(targetWithDefault, [panel("rounded-xl")], screen.root)).toBe("rounded-xl");
  expect(collectDocumentTailwind(targetWithDefault, [panel()], screen.root)).toBe("p-4");
});
