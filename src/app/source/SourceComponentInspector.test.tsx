import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    { name: "title", type: "string", required: true, kind: "string", slot: false },
    { name: "tone", type: '"quiet" | "strong"', required: false, kind: "string", slot: false },
    { name: "children", type: "React.ReactNode", required: false, kind: "unknown", slot: true },
    {
      name: "actions",
      type: "readonly React.ReactElement<ActionProps>[]",
      required: true,
      kind: "unknown",
      slot: true,
      multiple: true,
    },
  ],
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
  expect(within(slots).getByText("children")).toBeVisible();
  expect(slots).toHaveTextContent("React.ReactNode");
  expect(within(slots).getByText("actions")).toBeVisible();
  expect(slots).toHaveTextContent("readonly React.ReactElement<ActionProps>[]");
  expect(slots).toHaveTextContent("Multiple");

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Code" })).not.toBeInTheDocument();
});

it("renders an honest empty selection state", () => {
  render(<SourceComponentInspector />);
  expect(screen.getByText("Select an exported component to inspect its TypeScript contract.")).toBeVisible();
});

it("edits a selected HTML layer through its source-derived Tailwind binding", () => {
  const change = vi.fn();
  const binding = { value: "p-4", start: 40, end: 55 };
  const styleEditor = {
    binding,
    change,
    css: "",
    editable: true,
    error: undefined,
    reset: vi.fn(),
    value: "p-4",
  } satisfies SourceLayerClassEditor;

  render(
    <SourceComponentInspector
      entry={entry}
      layer={{ id: "panel-section", label: "section", kind: "html", children: [], className: binding }}
      styleEditor={styleEditor}
    />,
  );

  const design = screen.getByRole("region", { name: "Design" });
  const classes = within(design).getByRole("combobox", { name: "Tailwind classes" });
  expect(classes).toHaveValue("p-4");
  fireEvent.change(classes, { target: { value: "p-6 rounded-xl" } });
  expect(change).toHaveBeenCalledWith("p-6 rounded-xl");
});
