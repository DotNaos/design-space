import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { createTargetViewModel } from "../target-model";
import { documentToFixture } from "./fixture-document";
import { slotHasCapacity } from "./slot-capacity";

describe("design document fixture projection", () => {
  it("preserves a recipe outlet as occupied derived state for capacity checks", () => {
    const fixture = documentToFixture(panelDocument);

    expect(fixture.slots.content).toEqual([{
      kind: "text",
      id: "panel.body.outlet",
      value: "",
    }]);

    const view = createTargetViewModel(target, false, fixture, [panelDocument], {
      contractValidation: "tolerant",
    });
    expect(view.slots).toMatchObject([{
      label: "Content",
      occupied: true,
      childCount: 1,
    }]);
    expect(slotHasCapacity({ max: 1 }, view.slots[0]!.childCount)).toBe(false);
  });

  it("does not inject an implementation outlet into an authored component's public slot", () => {
    const screenDocument: DesignDocument = {
      schemaVersion: 2,
      id: "screen.panel",
      label: "Panel screen",
      kind: "screen",
      root: {
        instanceId: "panel.instance",
        adapterId: "panel",
        slots: { body: [] },
      },
    };

    const view = createTargetViewModel(
      target,
      false,
      documentToFixture(screenDocument),
      [panelDocument],
      { contractValidation: "tolerant" },
    );

    expect(view.slots).toMatchObject([{
      label: "Body",
      occupied: false,
      childCount: 0,
    }]);
  });
});

const panelDocument: DesignDocument = {
  schemaVersion: 2,
  id: "component.panel",
  label: "Panel",
  kind: "component",
  component: {
    id: "panel",
    label: "Panel",
    group: "Surfaces",
    recipeId: "recipe.component.stack",
    properties: [],
    slots: [{ id: "body", label: "Body" }],
  },
  root: {
    instanceId: "panel.template",
    adapterId: "stack",
    slots: {
      content: [{ kind: "slot-outlet", id: "panel.body.outlet", slotId: "body" }],
    },
  },
};

const target: TargetModule = {
  project: { id: "fixture-projection", label: "Fixture projection" },
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "legacy", adapterId: "stack", slots: { content: [] } },
  files: [],
  componentRecipes: [{
    id: "recipe.component.stack",
    label: "Stack component",
    rootAdapterId: "stack",
    rootSlotId: "content",
  }],
  adapters: [{
    component: {
      id: "stack",
      label: "Stack",
      group: "Layout",
      slots: [{ id: "content", label: "Content", max: 1 }],
    },
    render: (_props, context) => context.slotChildren.content,
  }],
};
