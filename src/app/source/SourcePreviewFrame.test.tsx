import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import {
  applySourceLayerClassName,
  applySourceLayerText,
  projectSourceLayer,
  SourcePreviewFrame,
} from "./SourcePreviewFrame";

afterEach(cleanup);

it("requires a colocated design instead of executing the source component", () => {
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
  expect(screen.getByText("Design required")).toBeVisible();
  expect(screen.getByText(/colocated design/)).toBeVisible();
  expect(component).not.toHaveBeenCalled();
});

it("offers best-effort design generation from the empty canvas", async () => {
  const onGenerateDesign = vi.fn();
  const entry = {
    ...previewEntry("panel", async () => previewDefinition("unused")),
    design: undefined,
  };
  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} onGenerateDesign={onGenerateDesign} />);
  await userEvent.click(screen.getByRole("button", { name: "Generate design" }));
  expect(onGenerateDesign).toHaveBeenCalledOnce();
});

it("renders source previews as static, non-focusable UI", async () => {
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
    design: {
      fileId: "dashboard-design",
      relativePath: "src/app/desktop/pages/Dashboard.design.tsx",
      load: async () => ({
        component: () => null,
        defaults: {},
        initialCase: "default",
        isStateful: false,
        cases: { default: {} },
        render: () => <button type="button">Designed action</button>,
      }),
    },
  } satisfies RuntimeSourceWorkspaceEntry;

  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} />);
  const frame = await screen.findByTitle("Dashboard desktop preview");
  expect(frame).toHaveClass("pointer-events-none");
  expect(frame).toHaveAttribute("tabindex", "-1");
  expect(frame).toHaveAttribute("inert");
  expect(frame).toHaveProperty("inert", true);
  expect(screen.queryByRole("button", { name: "Switch to interact mode" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

it("shows a checking state while switching between asynchronously loaded designs", async () => {
  const first = previewEntry("first", async () => previewDefinition("First design"));
  let resolveSecond: ((value: ReturnType<typeof previewDefinition>) => void) | undefined;
  const second = previewEntry("second", () => new Promise((resolve) => { resolveSecond = resolve; }));
  const view = render(<SourcePreviewFrame device="desktop" entry={first} runtime="react" styles={[]} />);
  expect(await screen.findByTitle("first desktop preview")).toBeVisible();

  view.rerender(<SourcePreviewFrame device="desktop" entry={second} runtime="react" styles={[]} />);
  expect(screen.getByText("Checking design")).toBeVisible();
  resolveSecond?.(previewDefinition("Second design"));
  expect(await screen.findByTitle("second desktop preview")).toBeVisible();
});

it("reports an invalid design without falling back to direct component execution", async () => {
  const component = vi.fn(() => null);
  const entry = {
    ...previewEntry("invalid", async () => { throw new Error("Design compile failed"); }),
    component,
  };
  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} />);
  expect(await screen.findByText("Design invalid")).toBeVisible();
  expect(screen.getByText("Design compile failed")).toBeVisible();
  expect(component).not.toHaveBeenCalled();
});

it("keeps the last valid preview when the same design temporarily becomes invalid", async () => {
  const entry = previewEntry("stable", async () => previewDefinition("Stable design"));
  const view = render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} />);
  expect(await screen.findByTitle("stable desktop preview")).toBeVisible();

  view.rerender(<SourcePreviewFrame
    device="desktop"
    entry={{
      ...entry,
      design: {
        ...entry.design!,
        load: async () => { throw new Error("Temporary design error"); },
      },
    }}
    runtime="react"
    styles={[]}
  />);

  expect(await screen.findByText("Last valid")).toBeVisible();
  expect(screen.getByTitle("stable desktop preview")).toBeVisible();
});

it("keeps finite compiler-derived properties available to the preview matrix", () => {
  const direct = {
    id: "prompt",
    label: "Prompt",
    area: "components",
    device: "desktop",
    fileId: "prompt-file",
    relativePath: "src/app/components/Prompt/index.tsx",
    exportName: "Prompt",
    props: [{ name: "size", type: '"sm" | "md"', required: true, kind: "string", values: ["sm", "md"] }],
    slots: [],
    findings: [],
    source: { start: 0, end: 1 },
    component: () => null,
  } satisfies RuntimeSourceWorkspaceEntry;
  expect(direct.props[0]?.values).toEqual(["sm", "md"]);
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

function previewDefinition(label: string) {
  return {
    component: () => null,
    defaults: {},
    initialCase: "default",
    isStateful: false,
    cases: { default: {} },
    render: () => <p>{label}</p>,
  };
}

function previewEntry(id: string, load: () => Promise<ReturnType<typeof previewDefinition>>): RuntimeSourceWorkspaceEntry {
  return {
    id,
    label: id,
    area: "components",
    device: "desktop",
    fileId: `${id}-file`,
    relativePath: `src/app/components/${id}.tsx`,
    exportName: id,
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 1 },
    component: () => null,
    design: { fileId: `${id}-design`, relativePath: `src/app/components/${id}.design.tsx`, load },
  };
}
