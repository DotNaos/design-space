import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ComponentFixture, TargetModule } from "../shared/target-module";
import type { DesignDocument } from "../shared/design-document";
import { projectPreviewSlots } from "../model";
import {
  appendFixtureChild,
  createTargetViewModel,
  duplicateFixtureComponent,
  findComponentFixture,
  findFixtureLocation,
  findComponentInstance,
  moveFixtureComponent,
  removeFixtureComponent,
  renderTargetFixture,
  updateFixtureProps,
} from "./target-model";

const genericTarget: TargetModule = {
  project: { id: "other-app", label: "Other React app" },
  defaultAdapterId: "panel",
  defaultFixture: {
    instanceId: "welcome",
    adapterId: "panel",
    slots: {
      content: [{ kind: "component", node: { instanceId: "message", adapterId: "copy", slots: {} } }],
    },
  },
  files: [{ id: "panel.source", label: "Panel.tsx", kind: "file" }],
  adapters: [
    {
      component: { id: "panel", label: "Panel", group: "Layout", slots: [{ id: "content", label: "Content" }] },
      render: (_props, context) => <section {...context.slotAttributes.content}>{context.slotChildren.content}</section>,
    },
    {
      component: { id: "copy", label: "Copy", group: "Content", slots: [] },
      render: () => <p>Hello from another target</p>,
    },
  ],
};

describe("target-driven application model", () => {
  it("builds the visible tree and direct preview from an arbitrary target fixture", () => {
    const view = createTargetViewModel(genericTarget, false);
    expect(view.rows.map((row) => row.kind === "component" ? row.label : row.kind)).toEqual([
      "Panel",
      "slot",
      "Copy",
    ]);
    render(renderTargetFixture(genericTarget, genericTarget.defaultFixture));
    const copy = screen.getByText("Hello from another target");
    expect(copy).toBeVisible();
    expect(copy).toHaveAttribute("data-design-space-instance-id", "message");
    expect(copy.closest("section")).toHaveAttribute("data-design-space-slot-id", "slot:welcome:content");
  });

  it("blocks fixture children assigned to undeclared slots", () => {
    const invalid: TargetModule = {
      ...genericTarget,
      defaultFixture: { ...genericTarget.defaultFixture, slots: { arbitrary: [] } },
    };
    expect(() => createTargetViewModel(invalid, false)).toThrow(/does not declare slot arbitrary/);
  });

  it("renders text children with stable keys and no React reconciliation warning", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fixture: ComponentFixture = {
      instanceId: "copy-list",
      adapterId: "panel",
      slots: {
        content: [
          { kind: "text", id: "copy.first", value: "First" },
          { kind: "text", id: "copy.second", value: "Second" },
        ],
      },
    };

    render(renderTargetFixture(genericTarget, fixture));

    expect(screen.getByText("First")).toBeVisible();
    expect(screen.getByText("Second")).toBeVisible();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("anchors fragment adapters without adding a layout box", () => {
    const fragmentTarget: TargetModule = {
      ...genericTarget,
      defaultAdapterId: "fragment",
      defaultFixture: { instanceId: "fragment.one", adapterId: "fragment", slots: {} },
      adapters: [{
        component: { id: "fragment", label: "Fragment", group: "Content", slots: [] },
        render: () => <><strong>First</strong><em>Second</em></>,
      }],
    };

    render(renderTargetFixture(fragmentTarget, fragmentTarget.defaultFixture));

    const anchor = globalThis.document.querySelector('[data-design-space-instance-id="fragment.one"]');
    expect(anchor).toHaveStyle({ display: "contents" });
    expect(anchor?.querySelector("strong")).toHaveTextContent("First");
    expect(anchor?.querySelector("em")).toHaveTextContent("Second");
  });

  it("keeps the authoring view available during transient contract inconsistencies", () => {
    const staleFixture: ComponentFixture = {
      ...genericTarget.defaultFixture,
      slots: {
        removed: [{ kind: "text", id: "stale-copy", value: "Still being migrated" }],
      },
    };
    const inconsistentComponent: DesignDocument = {
      schemaVersion: 2,
      id: "component.draft-card",
      label: "Draft card",
      kind: "component",
      root: { instanceId: "draft-card-root", adapterId: "panel", slots: {} },
      component: {
        id: "draft-card",
        label: "Draft card",
        group: "Drafts",
        properties: [],
        slots: [{ id: "content", label: "Content", min: 2, max: 1 }],
      },
    };

    expect(() => createTargetViewModel(genericTarget, false, staleFixture, [inconsistentComponent]))
      .toThrow(/impossible range/);

    const view = createTargetViewModel(
      genericTarget,
      false,
      staleFixture,
      [inconsistentComponent],
      { contractValidation: "tolerant" },
    );

    expect(view.root).toMatchObject({
      instanceId: "welcome",
      slots: [{ slotId: "removed" }],
    });
    expect(view.catalog.adapters.get("draft-card")?.slots).toMatchObject([
      { id: "content", minimum: 2, maximum: 1 },
    ]);
    expect(view.rows.filter((row) => row.kind === "slot")).toMatchObject([
      { label: "Content", occupied: false, childCount: 0 },
    ]);
    expect(view.slots).toMatchObject([
      { label: "Content", occupied: false, childCount: 0 },
    ]);
  });

  it("creates preview anchors for declared optional slots omitted by the fixture", () => {
    const targetWithOmittedOptionalSlot: TargetModule = {
      ...genericTarget,
      defaultFixture: { ...genericTarget.defaultFixture, slots: {} },
    };
    const view = createTargetViewModel(targetWithOmittedOptionalSlot, false);
    expect(projectPreviewSlots(view.catalog, view.root)).toMatchObject([
      { label: "Content", occupied: false, childCount: 0 },
    ]);
    render(renderTargetFixture(targetWithOmittedOptionalSlot, targetWithOmittedOptionalSlot.defaultFixture));
    expect(document.querySelector("section")).toHaveAttribute("data-design-space-slot-id", "slot:welcome:content");
  });

  it("binds declared internal HTML to the rendered DOM with an instance-scoped ID", () => {
    const targetWithDom: TargetModule = {
      ...genericTarget,
      defaultFixture: { instanceId: "first-panel", adapterId: "panel", slots: { content: [] } },
      adapters: [{
        component: {
          id: "panel",
          label: "Panel",
          group: "Layout",
          slots: [{ id: "content", label: "Content" }],
          internalHtml: [{
            id: "panel.surface",
            tagName: "section",
            children: [{ id: "panel.content", tagName: "div" }],
          }],
        },
        render: (_props, context) => (
          <section {...context.htmlAttributes["panel.surface"]}>
            <div {...context.htmlAttributes["panel.content"]} {...context.slotAttributes.content}>
              {context.slotChildren.content}
            </div>
          </section>
        ),
      }],
    };

    const view = createTargetViewModel(targetWithDom, true);
    expect(view.rows.find((row) => row.kind === "html")?.selection.id)
      .toBe("html:first-panel:panel.surface");
    expect(view.rows.filter((row) => row.kind === "html")).toMatchObject([
      { depth: 2, label: "section" },
      { depth: 3, label: "div" },
    ]);
    render(renderTargetFixture(targetWithDom, targetWithDom.defaultFixture));
    expect(document.querySelector('[data-design-space-html-id="html:first-panel:panel.surface"]'))
      .toHaveAttribute("data-design-space-html-id", "html:first-panel:panel.surface");
    expect(document.querySelector('[data-design-space-html-id="html:first-panel:panel.content"]'))
      .toHaveAttribute("data-design-space-html-id", "html:first-panel:panel.content");
  });

  it("opens a registered document whose root differs from the target default", () => {
    const componentDocumentRoot: ComponentFixture = {
      instanceId: "component-root",
      adapterId: "copy",
      slots: {},
    };

    const view = createTargetViewModel(genericTarget, false, componentDocumentRoot);

    expect(view.root.componentId).toBe("copy");
    expect(view.rows).toMatchObject([
      { kind: "component", label: "Copy" },
    ]);
  });

  it("resolves nested component slots and inserts into the selected nested fixture", () => {
    const nestedTarget: TargetModule = {
      ...genericTarget,
      defaultFixture: {
        instanceId: "welcome",
        adapterId: "panel",
        slots: {
          content: [{
            kind: "component",
            node: { instanceId: "stack", adapterId: "stack", slots: { content: [] } },
          }],
        },
      },
      adapters: [
        ...genericTarget.adapters,
        {
          component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
          render: (_props, context) => <div>{context.slotChildren.content}</div>,
        },
      ],
    };
    const view = createTargetViewModel(nestedTarget, false);
    const stack = findComponentInstance(view.root, "stack");
    expect(stack && projectPreviewSlots(view.catalog, stack)).toMatchObject([
      { label: "Content", occupied: false, childCount: 0 },
    ]);

    const inserted = appendFixtureChild(nestedTarget.defaultFixture, "stack", "content", {
      kind: "component",
      node: { instanceId: "nested-copy", adapterId: "copy", slots: {} },
    });
    expect(findComponentFixture(inserted, "stack")?.slots.content).toHaveLength(1);
    expect(findComponentFixture(nestedTarget.defaultFixture, "stack")?.slots.content).toHaveLength(0);
  });

  it("updates, reorders, duplicates, and removes fixture items immutably", () => {
    const fixture: ComponentFixture = {
      instanceId: "root",
      adapterId: "panel",
      slots: {
        content: [
          { kind: "component", node: { instanceId: "first", adapterId: "copy", props: { children: "First" }, slots: {} } },
          { kind: "component", node: { instanceId: "second", adapterId: "copy", props: { children: "Second" }, slots: {} } },
        ],
      },
    };

    const updated = updateFixtureProps(fixture, "first", { children: "Changed" });
    expect(findComponentFixture(updated, "first")?.props?.children).toBe("Changed");
    expect(findComponentFixture(fixture, "first")?.props?.children).toBe("First");
    const cleared = updateFixtureProps(updated, "first", { children: undefined });
    expect(findComponentFixture(cleared, "first")?.props).toBeUndefined();

    const moved = moveFixtureComponent(updated, "first", 1);
    expect((moved.slots.content[1] as { node: ComponentFixture }).node.instanceId).toBe("first");

    let sequence = 0;
    const duplicated = duplicateFixtureComponent(moved, "first", () => `copy-${++sequence}`);
    expect(duplicated.duplicateId).toBe("copy-1");
    expect(findFixtureLocation(duplicated.fixture, "copy-1")).toMatchObject({ index: 2, siblingCount: 3 });

    const removed = removeFixtureComponent(duplicated.fixture, "copy-1");
    expect(findComponentFixture(removed, "copy-1")).toBeUndefined();
    expect(() => removeFixtureComponent(fixture, "root")).toThrow(/root component/);
  });
});
