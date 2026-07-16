import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import {
  applySourceLayerClassName,
  applySourceLayerText,
  projectSourceLayer,
  SourcePreviewFrame,
} from "./SourcePreviewFrame";

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
      { name: "title", type: "string", required: true, kind: "string" },
    ],
    slots: [],
    findings: [],
    source: { start: 0, end: 1 },
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
    slots: [],
    findings: [],
    source: { start: 0, end: 1 },
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

it("applies a visual class draft only to the isolated element", () => {
  const output = document.createElement("div");
  output.innerHTML = '<section class="p-4"><span>Child</span></section>';
  expect(applySourceLayerClassName(output, "p-8 rounded-xl")).toBe(true);
  expect(output.firstElementChild).toHaveClass("p-8", "rounded-xl");
  expect(output.querySelector("span")).not.toHaveAttribute("class");
});

it("applies a visual text draft without removing nested elements", () => {
  const output = document.createElement("div");
  output.innerHTML = '<p>Ready <strong>now</strong></p>';
  expect(applySourceLayerText(output, "Needs review ")).toBe(true);
  expect(output.querySelector("p")?.firstChild).toHaveTextContent("Needs review");
  expect(output.querySelector("strong")).toHaveTextContent("now");
  expect(applySourceLayerText(output, "")).toBe(true);
  expect(applySourceLayerText(output, "Ready again ")).toBe(true);
  expect(output.querySelector("p")?.firstChild).toHaveTextContent("Ready again");
});
