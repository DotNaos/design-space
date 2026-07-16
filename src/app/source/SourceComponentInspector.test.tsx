import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import type { SourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourceComponentInspector } from "./SourceComponentInspector";

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
