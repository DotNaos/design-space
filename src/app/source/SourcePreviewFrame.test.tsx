import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import {
  applySourceLayerClassName,
  applySourceLayerClassNameById,
  applySourceLayerText,
  applySourceLayerTextById,
  projectSourceLayer,
  SourcePreviewFrame,
} from "./SourcePreviewFrame";
import { scalePreviewEventPoint, sourceLayerIdAtPreviewPoint, sourceLayerIdFromElement } from "./source-preview-hit-testing";
import { measureSourceLayer, mountSourceLayerHover, mountSourceLayerSelection, sourceLayerBounds } from "./source-preview-selection-overlay";
import { renderStaticSourcePreviewMarkup } from "./source-static-preview";

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

it("places a non-interactive selection surface over authored HTML in design mode", async () => {
  const entry = previewEntry("selectable", async () => previewDefinition("Selectable design"));
  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" selectionMode styles={[]} onSelectLayer={vi.fn()} />);
  const frame = await screen.findByTitle("selectable desktop preview");
  expect(frame).toHaveClass("pointer-events-none");
  expect(frame).toHaveAttribute("inert");
  expect(frame).toHaveProperty("inert", true);
  expect(screen.getByTestId("source-preview-selection-surface"))
    .toHaveAttribute("data-design-space-canvas-action");
});

it("separates design selection from playable component interactions", async () => {
  const onSelectLayer = vi.fn();
  const onAction = vi.fn();
  const layerId = "jsx:interactive-button";
  const entry = {
    ...previewEntry("interactive", async () => ({
      ...previewDefinition("Interactive"),
      render: () => <button data-design-space-source-layer-id={layerId} type="button" onClick={onAction}>Run action</button>,
    })),
    layers: [{ id: layerId, label: "button", kind: "html" as const, source: { start: 2, end: 3 }, children: [] }],
  };
  const view = render(<SourcePreviewFrame device="desktop" entry={entry} mode="design" runtime="react" styles={[]} onModeChange={() => undefined} onSelectLayer={onSelectLayer} />);
  const frame = await screen.findByTitle("interactive desktop preview");
  expect(frame).toHaveClass("pointer-events-none");
  expect(frame).toHaveAttribute("inert");
  expect(screen.getByTestId("source-preview-selection-surface")).toBeVisible();
  expect(screen.getByRole("button", { name: "Design mode" })).toHaveAttribute("aria-pressed", "true");

  view.rerender(<SourcePreviewFrame device="desktop" entry={entry} mode="play" runtime="react" styles={[]} onModeChange={() => undefined} onSelectLayer={onSelectLayer} />);
  const playable = await screen.findByRole("region", { name: "interactive interactive preview" });
  expect(playable).toHaveClass("overflow-auto");
  await userEvent.click(screen.getByRole("button", { name: "Run action" }));
  expect(screen.getByRole("button", { name: "Play mode" })).toHaveAttribute("aria-pressed", "true");
  expect(onAction).toHaveBeenCalledOnce();
});

it("serializes design content without keeping component handlers attached", async () => {
  const onAction = vi.fn();
  function InteractiveDesign() {
    return <button type="button" onClick={onAction}>Run action</button>;
  }
  const definition = {
    ...previewDefinition("unused"),
    render: () => <InteractiveDesign />,
  };
  const markup = await renderStaticSourcePreviewMarkup({
    caseName: "default",
    definition,
    entry: previewEntry("static", async () => previewDefinition("unused")),
    matrix: false,
  });
  const container = document.createElement("div");
  container.innerHTML = markup;
  const button = container.querySelector("button")!;
  button.click();

  expect(button).toHaveTextContent("Run action");
  expect(onAction).not.toHaveBeenCalled();
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

it("maps a nested canvas target to its nearest authored source layer", () => {
  const layer = document.createElement("section");
  layer.dataset.designSpaceSourceLayerId = "jsx:src/app/Panel.tsx:42";
  const child = document.createElement("span");
  layer.append(child);
  expect(sourceLayerIdFromElement(child)).toBe("jsx:src/app/Panel.tsx:42");
  expect(sourceLayerIdFromElement(document.createTextNode("text"))).toBeUndefined();
  expect(sourceLayerIdFromElement({
    closest: () => layer,
  } as unknown as EventTarget)).toBe("jsx:src/app/Panel.tsx:42");
});

it("maps a host-canvas click through a scaled iframe to its source layer", () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const clicked = document.createElement("h2");
  clicked.dataset.designSpaceSourceLayerId = "heading";
  Object.defineProperty(frameDocument.documentElement, "clientWidth", { configurable: true, value: 1000 });
  Object.defineProperty(frameDocument.documentElement, "clientHeight", { configurable: true, value: 500 });
  frame.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect;
  frameDocument.elementFromPoint = vi.fn(() => clicked);

  expect(sourceLayerIdAtPreviewPoint(
    frame,
    { clientX: 200, clientY: 100 },
    new Set(["heading"]),
  )).toBe("heading");
  expect(frameDocument.elementFromPoint).toHaveBeenCalledWith(500, 250);
});

it("falls back to the component boundary when an external primitive has no source marker", () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const external = document.createElement("button");
  Object.defineProperty(frameDocument.documentElement, "clientWidth", { configurable: true, value: 100 });
  Object.defineProperty(frameDocument.documentElement, "clientHeight", { configurable: true, value: 100 });
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  frameDocument.elementFromPoint = vi.fn(() => external);

  expect(sourceLayerIdAtPreviewPoint(
    frame,
    { clientX: 10, clientY: 20 },
    new Set(["component-root"]),
    "component-root",
  )).toBe("component-root");
});

it("maps pointer coordinates through a scaled preview frame", () => {
  expect(scalePreviewEventPoint(
    { clientX: 416, clientY: 260 },
    { width: 832, height: 520 },
    { width: 1_280, height: 800 },
  )).toEqual({ x: 640, y: 400 });
});

it("measures a selected layer relative to its rendered canvas root", () => {
  expect(measureSourceLayer(
    { left: 124, top: 88, width: 320, height: 96 },
    { left: 24, top: 40 },
  )).toEqual({ x: 100, y: 48, width: 320, height: 96 });
});

it("keeps selection handles inside the preview boundary", () => {
  const output = document.createElement("div");
  document.body.append(output);
  const dispose = mountSourceLayerSelection(document, output, "selected", "layer");
  const overlay = document.querySelector<HTMLElement>("[data-design-space-source-selection]")!;
  const handles = [...overlay.querySelectorAll<HTMLElement>("span")];

  expect(handles).toHaveLength(4);
  expect(handles.every((handle) => handle.style.transform === "")).toBe(true);

  dispose();
  output.remove();
});

it("renders hover feedback as a lightweight outline without selection handles", () => {
  const output = document.createElement("div");
  document.body.append(output);
  const dispose = mountSourceLayerHover(document, output, "hovered");
  const overlay = document.querySelector<HTMLElement>("[data-design-space-source-hover]")!;

  expect(overlay.dataset.designSpaceSourceHover).toBe("hovered");
  expect(overlay.querySelector("span")).toBeNull();
  expect(overlay.style.borderWidth).toBe("1px");

  dispose();
  output.remove();
});

it("measures display-contents roots from their visible descendants", () => {
  const root = document.createElement("div");
  const first = document.createElement("header");
  const second = document.createElement("main");
  root.append(first, second);
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
  first.getBoundingClientRect = () => ({ left: 20, top: 30, width: 100, height: 40 }) as DOMRect;
  second.getBoundingClientRect = () => ({ left: 10, top: 80, width: 240, height: 120 }) as DOMRect;

  expect(sourceLayerBounds(root)).toEqual({ left: 10, top: 30, width: 240, height: 170 });
});

it("ignores host and design-fixture markers while selecting registered source layers", () => {
  const source = document.createElement("button");
  source.dataset.designSpaceSourceLayerId = "jsx:src/components/Button.tsx:42";
  const fixture = document.createElement("div");
  fixture.dataset.designSpaceSourceLayerId = "jsx:src/components/Button.design.tsx:9";
  const host = document.createElement("section");
  host.dataset.designSpaceSourceLayerId = "jsx:src/app/source/SourcePreviewFrame.tsx:12";
  fixture.append(source);
  host.append(fixture);

  expect(sourceLayerIdFromElement(source, new Set(["jsx:src/components/Button.tsx:42"])))
    .toBe("jsx:src/components/Button.tsx:42");
  expect(sourceLayerIdFromElement(fixture, new Set(["jsx:src/components/Button.tsx:42"])))
    .toBeUndefined();
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

it("projects a visual draft into one nested layer while keeping the full component", () => {
  const output = document.createElement("div");
  output.innerHTML = '<article data-design-space-source-layer-id="card"><h2 data-design-space-source-layer-id="title">Old <span>badge</span></h2></article>';

  expect(applySourceLayerClassNameById(output, "title", "text-lg")).toBe(true);
  expect(applySourceLayerTextById(output, "title", "New ")).toBe(true);
  expect(output.querySelector("article")).not.toBeNull();
  expect(output.querySelector("h2")).toHaveClass("text-lg");
  expect(output.querySelector("h2")).toHaveTextContent("New badge");
  expect(output.querySelector("span")).toHaveTextContent("badge");
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
