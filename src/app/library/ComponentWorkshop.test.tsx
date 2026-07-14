import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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
      documents={[component]}
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

it("removes cleared maximum and accepted-component constraints from the saved slot", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  function Harness() {
    const [document, setDocument] = useState<DesignDocument>({
      ...component,
      component: {
        ...component.component!,
        slots: [{
          id: "content",
          label: "Content",
          max: 2,
          accepts: ["catalog.heading"],
          acceptsText: true,
        }],
      },
    });
    return (
      <ComponentWorkshop
        className="flex w-full"
        document={document}
        documents={[document]}
        catalogComponents={[{ id: "catalog.heading", label: "Heading", controls: [] }]}
        onChange={(nextDocument) => {
          setDocument(nextDocument);
          onChange(nextDocument);
        }}
        onEditImplementation={vi.fn()}
      />
    );
  }
  render(<Harness />);

  await user.clear(screen.getByRole("spinbutton", { name: "Maximum children" }));
  let changed = onChange.mock.lastCall?.[0] as DesignDocument;
  expect(changed.component?.slots[0]).not.toHaveProperty("max");
  expect(changed.component?.slots[0]).toHaveProperty("accepts", ["catalog.heading"]);

  await user.click(screen.getByRole("button", { name: "Any component" }));
  changed = onChange.mock.lastCall?.[0] as DesignDocument;
  expect(changed.component?.slots[0]).not.toHaveProperty("max");
  expect(changed.component?.slots[0]).not.toHaveProperty("accepts");
});

it("keeps a public slot when another document depends on its component", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const document: DesignDocument = {
    ...component,
    component: {
      ...component.component!,
      slots: [{ id: "body", label: "Body", acceptsText: true }],
    },
  };
  const dependentScreen: DesignDocument = {
    schemaVersion: 2,
    id: "screen.dashboard",
    label: "Dashboard",
    kind: "screen",
    root: {
      instanceId: "dashboard.panel",
      adapterId: "panel",
      slots: { body: [] },
    },
  };
  render(
    <ComponentWorkshop
      className="flex w-full"
      document={document}
      documents={[document, dependentScreen]}
      catalogComponents={[]}
      onChange={onChange}
      onEditImplementation={vi.fn()}
    />,
  );

  const remove = screen.getByRole("button", { name: "Remove Body slot" });
  expect(remove).toBeDisabled();
  expect(screen.getByText(/Cannot remove the Body slot because “Dashboard” uses Panel/)).toBeInTheDocument();
  await user.click(remove);
  expect(onChange).not.toHaveBeenCalled();
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
