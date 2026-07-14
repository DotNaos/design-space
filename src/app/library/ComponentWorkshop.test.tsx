import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import { ComponentWorkshop } from "./ComponentWorkshop";

it("keeps the complete component workshop scrollable on a phone and creates an explicit outlet", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <ComponentWorkshop
      className="flex w-full"
      document={component}
      recipe={{
        id: "stack-component",
        label: "Stack component",
        rootAdapterId: "stack",
        rootSlotId: "content",
      }}
      catalogComponents={[]}
      onChange={onChange}
      onEditImplementation={vi.fn()}
    />,
  );

  expect(screen.getByRole("complementary")).toHaveClass("h-full", "min-h-0", "overflow-y-auto");
  await user.click(screen.getByRole("button", { name: /slot$/i }));

  const changed = onChange.mock.lastCall?.[0] as DesignDocument;
  expect(changed.component?.slots).toContainEqual(expect.objectContaining({ id: "slot-1", label: "Slot 1" }));
  expect(changed.root.slots.content).toContainEqual({
    kind: "slot-outlet",
    id: "slot-1-outlet",
    slotId: "slot-1",
  });

  await user.click(screen.getByRole("button", { name: "Implementation" }));
  expect(screen.queryByRole("button", { name: "Edit component body" })).not.toBeInTheDocument();
});

const component: DesignDocument = {
  schemaVersion: 2,
  id: "component.panel",
  label: "Panel",
  kind: "component",
  component: {
    id: "panel",
    label: "Panel",
    group: "Custom",
    recipeId: "stack-component",
    properties: [],
    slots: [],
  },
  root: {
    instanceId: "panel.root",
    adapterId: "stack",
    slots: { content: [] },
  },
};
