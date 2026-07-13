import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TargetModule } from "../shared/target-module";
import { projectPreviewSlots } from "../model";
import {
  appendFixtureChild,
  createTargetViewModel,
  findComponentFixture,
  findComponentInstance,
  renderTargetFixture,
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
      render: (_props, context) => <section>{context.slotChildren.content}</section>,
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
    expect(screen.getByText("Hello from another target")).toBeVisible();
  });

  it("blocks fixture children assigned to undeclared slots", () => {
    const invalid: TargetModule = {
      ...genericTarget,
      defaultFixture: { ...genericTarget.defaultFixture, slots: { arbitrary: [] } },
    };
    expect(() => createTargetViewModel(invalid, false)).toThrow(/does not declare slot arbitrary/);
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
});
