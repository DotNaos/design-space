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

  expect(collectDocumentTailwind(target, [panel], screen.root!)).toBe("p-2 gap-4 p-6 rounded-xl mt-2");
});

it("collects Tailwind overrides from internal HTML nodes", () => {
  const screen: DesignDocument = {
    schemaVersion: 2,
    id: "screen.html",
    label: "HTML styles",
    kind: "screen",
    root: {
      instanceId: "stack.html",
      adapterId: "stack",
      htmlClassNames: { surface: "rounded-2xl p-8 border" },
      slots: { content: [] },
    },
  };

  expect(collectDocumentTailwind(target, [], screen)).toBe("rounded-2xl p-8 border");
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

  expect(collectDocumentTailwind(target, [outer, inner], screen.root!)).toBe("bg-cyan-500 p-4");
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

  expect(collectDocumentTailwind(targetWithDefault, [panel("rounded-xl")], screen.root!)).toBe("rounded-xl");
  expect(collectDocumentTailwind(targetWithDefault, [panel()], screen.root!)).toBe("p-4");
});

it.each([
  ["a public default", "bg-public", "bg-public"],
  ["an explicit empty override", "", ""],
  ["an explicit null override", null, ""],
])("collects a component document implementation with %s", (_label, defaultValue, expected) => {
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
      instanceId: "surface.root",
      adapterId: "stack",
      props: { className: "implementation-class" },
      propertyBindings: { className: "surface.class" },
      slots: { content: [] },
    },
  };
  const targetWithDefault: TargetModule = {
    ...target,
    adapters: target.adapters.map((adapter) => ({ ...adapter, defaultProps: { className: "adapter-default" } })),
  };

  expect(collectDocumentTailwind(targetWithDefault, [componentDocument], componentDocument)).toBe(expected);
});

it("collects a finite self-instance reached through a projected slot", () => {
  const slotContainer: DesignDocument = {
    schemaVersion: 2,
    id: "component.slot-container",
    label: "Slot container",
    kind: "component",
    component: {
      id: "slot-container",
      label: "Slot container",
      group: "Custom",
      properties: [{
        id: "slot-container.surface",
        label: "Surface",
        prop: "surface",
        kind: "tailwind",
        defaultValue: "outer-token",
      }],
      slots: [{ id: "content", label: "Content" }],
    },
    root: {
      instanceId: "slot-container.root",
      adapterId: "stack",
      propertyBindings: { className: "slot-container.surface" },
      slots: {
        content: [{ kind: "slot-outlet", id: "slot-container.outlet", slotId: "content" }],
      },
    },
  };
  const screen: DesignDocument = {
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
          node: {
            instanceId: "slot-container.inner",
            adapterId: "slot-container",
            props: { surface: "nested-token" },
            slots: { content: [] },
          },
        }],
      },
    },
  };

  expect(collectDocumentTailwind(target, [slotContainer], screen)).toBe("outer-token nested-token");
});

it("bounds genuine authored definition cycles without recursing forever", () => {
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
    component: {
      id: "recursive",
      label: "Recursive",
      group: "Custom",
      properties: [],
      slots: [],
    },
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
  const screen: DesignDocument = {
    schemaVersion: 2,
    id: "screen.recursive",
    label: "Recursive screen",
    kind: "screen",
    root: { instanceId: "recursive.instance", adapterId: "recursive", slots: {} },
  };

  expect(collectDocumentTailwind(target, [recursive, forwarder], screen)).toBe("");
});
