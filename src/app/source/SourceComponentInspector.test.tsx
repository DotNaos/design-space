import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { SourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourceComponentInspector } from "./SourceComponentInspector";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

afterEach(cleanup);

const entry: SourceWorkspaceEntry = {
  id: "panel",
  label: "Panel",
  area: "components",
  device: "desktop",
  fileId: "panel-file",
  relativePath: "src/app/components/Panel/desktop.tsx",
  exportName: "Panel",
  props: [
    { name: "title", type: "string", required: true, kind: "string" },
    { name: "tone", type: '"quiet" | "strong"', required: false, kind: "string" },
  ],
  slots: [
    {
      name: "actions",
      type: "ComponentSlotList<typeof Action>",
      required: true,
      multiple: true,
      accepts: ["Action"],
      min: 1,
    },
  ],
  findings: [],
  source: { start: 0, end: 200 },
};

it("shows exact TypeScript prop and slot contracts without editable or invented values", () => {
  render(<SourceComponentInspector entry={entry} />);

  const props = screen.getByRole("region", { name: "Props" });
  expect(props).toHaveTextContent("title");
  expect(props).toHaveTextContent("string");
  expect(props).toHaveTextContent("Required");
  expect(props).toHaveTextContent("tone");
  expect(props).toHaveTextContent('"quiet" | "strong"');
  expect(props).toHaveTextContent("Optional");

  const slots = screen.getByRole("region", { name: "Slots" });
  expect(within(slots).getByText("actions")).toBeVisible();
  expect(slots).toHaveTextContent("ComponentSlotList<typeof Action>");
  expect(slots).toHaveTextContent("Required · 1+");
  expect(within(slots).getByText("Accepts")).toBeVisible();
  expect(within(slots).getByText("Action")).toBeVisible();
  expect(within(slots).getByText("Type definition")).toBeVisible();

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Code" })).not.toBeInTheDocument();
});

it("renders an honest empty selection state", () => {
  render(<SourceComponentInspector />);
  expect(screen.getByText("Select an exported component to inspect its TypeScript contract.")).toBeVisible();
});

it("fills every composed slot directly from the contract list", async () => {
  const onApplySlot = vi.fn();
  const onPrepareSlotEdit = vi.fn();
  const actionsSlot = {
    id: "panel-actions",
    label: "actions",
    kind: "slot" as const,
    source: { start: 20, end: 20 },
    children: [],
    slot: {
      contract: entry.slots[0]!,
      validity: "missing" as const,
      received: [],
      edit: { kind: "missing-property" as const, insertAt: 20 },
    },
  };

  render(
    <SourceComponentInspector
      entry={entry}
      slotEditorReady
      slotLayers={[actionsSlot]}
      candidatesForSlot={() => [{
        id: "action",
        name: "Action",
        group: "Project components",
        source: "src/Action.tsx",
        compatible: true,
        insertable: true,
        deviceState: "available",
      }]}
      onApplySlot={onApplySlot}
      onPrepareSlotEdit={onPrepareSlotEdit}
    />,
  );

  const picker = screen.getByRole("button", { name: "Add to actions slot" });
  expect(picker).toHaveTextContent("Choose components…");
  await userEvent.click(picker);
  expect(onPrepareSlotEdit).toHaveBeenCalledOnce();
  await userEvent.click(await screen.findByRole("button", { name: "Action, compatible" }));
  expect(onApplySlot).toHaveBeenCalledWith(actionsSlot, expect.objectContaining({ name: "Action" }), "add");
});

it("edits a selected HTML layer through its source-derived Tailwind binding", () => {
  const change = vi.fn();
  const changeText = vi.fn();
  const binding = { value: "p-4", start: 40, end: 55 };
  const textBinding = { value: "Panel", start: 56, end: 61, syntax: "text" as const };
  const styleEditor = {
    binding,
    change,
    changeText,
    css: "",
    editable: true,
    error: undefined,
    reset: vi.fn(),
    textBinding,
    textEditable: true,
    textValue: "Panel",
    value: "p-4",
  } satisfies SourceLayerClassEditor;

  render(
    <SourceComponentInspector
      entry={entry}
      layer={{ id: "panel-section", label: "section", kind: "html", source: { start: 20, end: 80 }, children: [], className: binding, text: textBinding }}
      styleEditor={styleEditor}
    />,
  );

  const design = screen.getByRole("region", { name: "Design" });
  const classes = screen.getByRole("combobox", { name: "className" });
  expect(classes).toHaveValue("p-4");
  expect(classes.compareDocumentPosition(design) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(classes, { target: { value: "p-6 rounded-xl" } });
  expect(change).toHaveBeenCalledWith("p-6 rounded-xl");

  const text = within(design).getByRole("textbox", { name: "Static text" });
  expect(text).toHaveValue("Panel");
  fireEvent.change(text, { target: { value: "Project panel" } });
  expect(changeText).toHaveBeenCalledWith("Project panel");
});
