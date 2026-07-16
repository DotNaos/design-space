import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { projectSourceLayer, SourcePreviewFrame } from "./SourcePreviewFrame";

afterEach(cleanup);

it("states that required TypeScript props are unset instead of inventing preview values", () => {
  const component = vi.fn(() => null);
  const entry = {
    id: "panel",
    label: "Panel",
    area: "components",
    device: "desktop",
    fileId: "panel-file",
    relativePath: "src/app/components/Panel/desktop.tsx",
    exportName: "Panel",
    props: [
      { name: "title", type: "string", required: true, kind: "string", slot: false },
      { name: "children", type: "ReactNode", required: false, kind: "unknown", slot: true, multiple: true },
    ],
    component,
  } satisfies RuntimeSourceWorkspaceEntry;

  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} />);
  expect(screen.getByText("Preview arguments required")).toBeVisible();
  expect(screen.getByText(/Required props: title/)).toBeVisible();
  expect(component).not.toHaveBeenCalled();
});

it("renders source previews as static, non-focusable UI", () => {
  const entry = {
    id: "dashboard",
    label: "Dashboard",
    area: "pages",
    device: "desktop",
    fileId: "dashboard-file",
    relativePath: "src/app/desktop/pages/Dashboard.tsx",
    exportName: "Dashboard",
    props: [],
    component: () => <button type="button">Target action</button>,
  } satisfies RuntimeSourceWorkspaceEntry;

  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} />);
  const frame = screen.getByTitle("Dashboard desktop preview");
  expect(frame).toHaveClass("pointer-events-none");
  expect(frame).toHaveAttribute("tabindex", "-1");
  expect(frame).toHaveAttribute("inert");
  expect(frame).toHaveProperty("inert", true);
  expect(screen.queryByRole("button", { name: "Switch to interact mode" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

it("projects only the selected authored HTML element", () => {
  const layerId = "jsx:src/app/desktop/pages/Dashboard.tsx:42";
  const staging = document.createElement("div");
  const output = document.createElement("div");
  staging.innerHTML = `<main><section data-design-space-source-layer-id="${layerId}"><h1>Selected section</h1></section><aside>Unselected sibling</aside></main>`;

  expect(projectSourceLayer(staging, output, layerId)).toBe(true);
  expect(output.querySelector(":scope > section")).toHaveTextContent("Selected section");
  expect(output.querySelector("aside")).not.toBeInTheDocument();
  expect(projectSourceLayer(staging, output, "missing-layer")).toBe(false);
});
