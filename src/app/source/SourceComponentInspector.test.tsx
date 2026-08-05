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

it("keeps each prop name, type, and requirement together in one compact row", () => {
  render(<SourceComponentInspector entry={entry} />);

  const titleRow = within(screen.getByRole("region", { name: "Props" })).getByText("title").closest("div");
  expect(titleRow).not.toBeNull();
  expect(within(titleRow!).getByText("string")).toBeVisible();
  expect(within(titleRow!).getByText("Required")).toBeVisible();
});

it("renders an honest empty selection state", () => {
  render(<SourceComponentInspector />);
  expect(screen.getByText("Select an exported component to inspect its TypeScript contract.")).toBeVisible();
});

it("keeps an external component selected without exposing stale properties", async () => {
  const onOpen = vi.fn();
  render(
    <SourceComponentInspector
      entry={entry}
      outsideCurrentFile={{
        currentRelativePath: "src/app/App.tsx",
        onOpen,
      }}
    />,
  );

  expect(screen.getByText("Outside the current file")).toBeVisible();
  const selectedComponent = screen.getByRole("region", { name: "Selected component" });
  expect(selectedComponent).toHaveTextContent(entry.label);
  expect(selectedComponent).toHaveTextContent(entry.relativePath);
  expect(screen.getByText("Used from src/app/App.tsx")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Props" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Slots" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Open component file" }));
  expect(onOpen).toHaveBeenCalledOnce();
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
    previewCss: "",
    previewTextValue: undefined,
    previewValue: undefined,
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
  expect(design.compareDocumentPosition(classes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(classes, { target: { value: "p-6 rounded-xl" } });
  expect(change).toHaveBeenCalledWith("p-6 rounded-xl");

  const text = within(design).getByRole("textbox", { name: "Static text" });
  expect(text).toHaveValue("Panel");
  fireEvent.change(text, { target: { value: "Project panel" } });
  expect(changeText).toHaveBeenCalledWith("Project panel");
});

it("keeps static text editable when an HTML layer has no className binding", () => {
  const changeText = vi.fn();
  const textBinding = { value: "Panel", start: 56, end: 61, syntax: "text" as const };
  const styleEditor = {
    binding: undefined,
    change: vi.fn(),
    changeText,
    css: "",
    editable: false,
    error: undefined,
    previewCss: "",
    previewTextValue: undefined,
    previewValue: undefined,
    reset: vi.fn(),
    textBinding,
    textEditable: true,
    textValue: "Panel",
    value: "",
  } satisfies SourceLayerClassEditor;

  render(
    <SourceComponentInspector
      entry={entry}
      layer={{
        id: "panel-copy",
        label: "p",
        kind: "html",
        source: { start: 20, end: 80 },
        children: [],
        text: textBinding,
      }}
      styleEditor={styleEditor}
    />,
  );

  const text = within(screen.getByRole("region", { name: "Design" })).getByRole("textbox", { name: "Static text" });
  expect(text).toHaveValue("Panel");
  fireEvent.change(text, { target: { value: "Project panel" } });
  expect(changeText).toHaveBeenCalledWith("Project panel");
  expect(screen.queryByRole("combobox", { name: "className" })).not.toBeInTheDocument();
});

it("edits a selected component when its contract exposes className", () => {
  const change = vi.fn();
  const binding = { value: "", start: 40, end: 40, insert: true as const };
  const styleEditor = {
    binding,
    change,
    changeText: vi.fn(),
    css: "",
    editable: true,
    error: undefined,
    previewCss: "",
    previewTextValue: undefined,
    previewValue: undefined,
    reset: vi.fn(),
    textBinding: undefined,
    textEditable: false,
    textValue: "",
    value: "",
  } satisfies SourceLayerClassEditor;

  render(
    <SourceComponentInspector
      entry={entry}
      layer={{
        id: "base-checkbox",
        label: "BaseCheckbox",
        kind: "component",
        source: { start: 20, end: 80 },
        children: [],
        className: binding,
      }}
      styleEditor={styleEditor}
    />,
  );

  expect(screen.getByRole("region", { name: "Design" })).toBeVisible();
  const classes = screen.getByRole("combobox", { name: "className" });
  fireEvent.change(classes, { target: { value: "rounded-md p-2" } });
  expect(change).toHaveBeenCalledWith("rounded-md p-2");
});

it("does not invent a visual editor for a component without className", () => {
  render(
    <SourceComponentInspector
      entry={entry}
      layer={{
        id: "plain-component",
        label: "PlainComponent",
        kind: "component",
        source: { start: 20, end: 80 },
        children: [],
      }}
    />,
  );

  expect(screen.queryByRole("region", { name: "Design" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "className" })).not.toBeInTheDocument();
});

it("opens the source component behind an imported selected layer", async () => {
  const onOpen = vi.fn();
  render(
    <SourceComponentInspector
      entry={entry}
      layer={{
        id: "base-checkbox",
        label: "BaseCheckbox",
        kind: "component",
        source: { start: 20, end: 80 },
        children: [],
        className: { value: "", start: 40, end: 40, insert: true },
      }}
      openLayerComponent={{ label: "BaseCheckbox", onOpen }}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Open BaseCheckbox component" }));
  expect(onOpen).toHaveBeenCalledOnce();
});
