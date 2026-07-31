import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { inspectSourceCodexOrigin } = vi.hoisted(() => ({
  inspectSourceCodexOrigin: vi.fn(async () => ({
    status: "active" as const,
    threadId: "019f651f-2bca-7513-9be5-857cb5fb86e6",
    title: "Design Space",
    writable: true,
  })),
}));

vi.mock("./source-codex-feedback-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("./source-codex-feedback-client")>(),
  inspectSourceCodexOrigin,
}));

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import {
  applySourceLayerClassName,
  applySourceLayerClassNameById,
  applySourceLayerText,
  applySourceLayerTextById,
  projectSourceLayer,
  SourcePreviewFrame,
  sourceStaticProjectionLayerId,
} from "./SourcePreviewFrame";
import { SourceInstanceNavigator } from "./SourceInstanceNavigator";
import { scalePreviewEventPoint, sourceLayerHitAtPreviewPoint, sourceLayerIdAtPreviewPoint, sourceLayerIdFromElement } from "./source-preview-hit-testing";
import { measureSourceLayer, mountSourceLayerHover, mountSourceLayerSelection, sourceLayerBounds, sourceLayerElement } from "./source-preview-selection-overlay";
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

it("keeps the Codex composer available in a library canvas", () => {
  render(
    <SourcePreviewFrame
      device="desktop"
      entry={previewEntry("LibraryButton", async () => previewDefinition("Library button"))}
      mode="design"
      runtime="react"
      styles={[]}
    />,
  );

  expect(screen.getByLabelText("Codex composer")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Codex feedback" })).toBeVisible();
});

it("places, edits, and removes spatial canvas annotations", async () => {
  const layer: SourceWorkspaceLayer = {
    children: [],
    id: "button-layer",
    kind: "html",
    label: "button",
    source: { start: 12, end: 24 },
  };
  const entry = {
    ...previewEntry("AnnotatedButton", async () => previewDefinition("Annotated button")),
    layers: [layer],
  };
  render(<SourcePreviewFrame device="desktop" entry={entry} mode="design" runtime="react" styles={[]} />);

  const toggle = screen.getByRole("button", { name: "Add a canvas annotation" });
  await waitFor(() => expect(toggle).toBeEnabled());
  await userEvent.click(toggle);
  expect(screen.getByText("Select an element to comment")).toBeVisible();

  const frame = await screen.findByTitle("AnnotatedButton desktop preview") as HTMLIFrameElement;
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 520 }) as DOMRect;
  frame.contentDocument!.elementFromPoint = vi.fn(() => null);
  const surface = screen.getByTestId("source-preview-selection-surface");
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 520 }) as DOMRect;
  fireEvent.click(surface, { clientX: 480, clientY: 260 });

  expect(screen.getByRole("form", { name: "Annotation for <button>" })).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "Annotation comment" }), {
    target: { value: "Make this action clearer." },
  });
  await userEvent.click(screen.getByRole("button", { name: "Add" }));

  const marker = await screen.findByRole("button", { name: "Edit annotation 1 for <button>" });
  expect(marker).toHaveTextContent("1");
  expect(screen.getByRole("button", { name: /Finish adding canvas annotations, 1 saved/ })).toBeVisible();

  await userEvent.click(marker);
  const editor = screen.getByRole("textbox", { name: "Annotation comment" });
  expect(editor).toHaveValue("Make this action clearer.");
  fireEvent.change(editor, { target: { value: "Clarify the primary action." } });
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("form", { name: "Annotation for <button>" })).not.toBeInTheDocument();

  await userEvent.click(marker);
  await userEvent.click(screen.getByRole("button", { name: "Delete annotation" }));
  expect(screen.queryByRole("button", { name: "Edit annotation 1 for <button>" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Finish adding canvas annotations, 0 saved/ })).toBeVisible();
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

it("does not key the full static preview to layer selection", () => {
  const firstLayer: SourceWorkspaceLayer = {
    id: "first-layer",
    label: "section",
    kind: "html",
    source: { start: 1, end: 2 },
    children: [],
  };
  const secondLayer: SourceWorkspaceLayer = {
    id: "second-layer",
    label: "aside",
    kind: "html",
    source: { start: 3, end: 4 },
    children: [],
  };
  const entry = {
    ...previewEntry("stable-preview", async () => ({
      ...previewDefinition("unused"),
      render: () => <main />,
    })),
    layers: [firstLayer, secondLayer],
  };
  expect(sourceStaticProjectionLayerId({
    entry,
    isolateSelectedLayer: false,
    selectedCase: "default",
    selectedLayer: firstLayer,
  })).toBeUndefined();
  expect(sourceStaticProjectionLayerId({
    entry,
    isolateSelectedLayer: false,
    selectedCase: "default",
    selectedLayer: secondLayer,
  })).toBeUndefined();
  expect(sourceStaticProjectionLayerId({
    entry,
    isolateSelectedLayer: true,
    selectedCase: "default",
    selectedLayer: firstLayer,
  })).toBe(firstLayer.id);
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

it("identifies the owning component and source file in a hover-only canvas HUD", async () => {
  const layerId = "jsx:src/app/components/Panel.tsx:12";
  const entry = {
    ...previewEntry("Panel", async () => previewDefinition("Panel design")),
    relativePath: "src/app/components/Panel.tsx",
    layers: [{
      id: layerId,
      label: "section",
      kind: "html" as const,
      source: { start: 12, end: 24 },
      children: [],
    }],
  };
  render(
    <SourcePreviewFrame
      device="desktop"
      entry={entry}
      mode="design"
      runtime="react"
      styles={[]}
      onSelectLayer={vi.fn()}
    />,
  );
  const frame = await screen.findByTitle("Panel desktop preview") as HTMLIFrameElement;
  const surface = screen.getByTestId("source-preview-selection-surface");
  const marker = frame.contentDocument!.createElement("section");
  marker.dataset.designSpaceSourceLayerId = layerId;
  frame.contentDocument!.body.append(marker);
  Object.defineProperty(frame.contentDocument!.documentElement, "clientWidth", { configurable: true, value: 1280 });
  Object.defineProperty(frame.contentDocument!.documentElement, "clientHeight", { configurable: true, value: 800 });
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 }) as DOMRect;
  frame.contentDocument!.elementFromPoint = vi.fn(() => marker);

  fireEvent.mouseMove(surface, { clientX: 20, clientY: 20 });

  const hud = await screen.findByTestId("canvas-hover-identity-hud");
  expect(hud).toHaveTextContent("Panel");
  expect(hud).toHaveTextContent("src/app/components/Panel.tsx");
  expect(hud).not.toHaveTextContent("Double-click to open");
  expect(document.querySelector("[data-design-space-gesture-hint]")).toBeNull();
});

it("selects a canvas slot without opening a component picker", async () => {
  const slotId = "slot.content";
  const slot: SourceWorkspaceLayer = {
    id: slotId,
    label: "content",
    kind: "slot",
    source: { start: 10, end: 10 },
    children: [],
    slot: {
      contract: { name: "content", type: "ComponentSlot<Panel>", required: true, multiple: false, accepts: ["Panel"], min: 1, max: 1 },
      validity: "missing",
      received: [],
      edit: { kind: "missing-property", insertAt: 10 },
    },
  };
  const entry = {
    ...previewEntry("slot-owner", async () => previewDefinition("Slot owner")),
    layers: [slot],
    slots: [slot.slot!.contract],
  };
  const onSelectLayer = vi.fn();
  render(
    <SourcePreviewFrame
      device="desktop"
      entry={entry}
      mode="design"
      runtime="react"
      slotLayers={[slot]}
      styles={[]}
      onSelectLayer={onSelectLayer}
    />,
  );
  const frame = await screen.findByTitle("slot-owner desktop preview") as HTMLIFrameElement;
  const surface = screen.getByTestId("source-preview-selection-surface");
  const frameDocument = frame.contentDocument!;
  const marker = frameDocument.createElement("span");
  marker.dataset.designSpaceSourceLayerId = slotId;
  frameDocument.body.append(marker);
  Object.defineProperty(frameDocument.documentElement, "clientWidth", { configurable: true, value: 1280 });
  Object.defineProperty(frameDocument.documentElement, "clientHeight", { configurable: true, value: 800 });
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 }) as DOMRect;
  frameDocument.elementFromPoint = vi.fn(() => marker);

  fireEvent.click(surface, { clientX: 20, clientY: 20 });

  expect(onSelectLayer).toHaveBeenCalledWith(slotId, 0);
  expect(screen.queryByRole("listbox", { name: "Compatible components" })).not.toBeInTheDocument();
});

it("requires a double click before opening a layer owned by another source file", async () => {
  const foreignLayerId = "jsx:src/Foreign.tsx:8";
  const current = {
    ...previewEntry("current", async () => ({
      ...previewDefinition("unused"),
      render: () => <button data-design-space-source-layer-id={foreignLayerId}>Foreign action</button>,
    })),
    layers: [{
      id: "jsx:src/Current.tsx:1",
      label: "main",
      kind: "html" as const,
      source: { start: 0, end: 10 },
      children: [],
    }],
  };
  const foreign = {
    ...previewEntry("foreign", async () => previewDefinition("foreign")),
    relativePath: "src/Foreign.tsx",
    layers: [{
      id: foreignLayerId,
      label: "button",
      kind: "html" as const,
      source: { start: 8, end: 9 },
      children: [],
    }],
  };
  const onSelectLayer = vi.fn();
  const onOpenLayerOwner = vi.fn();
  render(
    <SourcePreviewFrame
      device="desktop"
      entries={[current, foreign]}
      entry={current}
      mode="design"
      runtime="react"
      styles={[]}
      onOpenLayerOwner={onOpenLayerOwner}
      onSelectLayer={onSelectLayer}
    />,
  );
  const frame = await screen.findByTitle("current desktop preview") as HTMLIFrameElement;
  const surface = screen.getByTestId("source-preview-selection-surface");
  const frameDocument = frame.contentDocument!;
  const foreignElement = frameDocument.createElement("button");
  foreignElement.dataset.designSpaceSourceLayerId = foreignLayerId;
  frameDocument.body.append(foreignElement);
  Object.defineProperty(frameDocument.documentElement, "clientWidth", { configurable: true, value: 1280 });
  Object.defineProperty(frameDocument.documentElement, "clientHeight", { configurable: true, value: 800 });
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 }) as DOMRect;
  frameDocument.elementFromPoint = vi.fn(() => foreignElement);

  fireEvent.mouseMove(surface, { clientX: 20, clientY: 20 });
  const hud = await screen.findByTestId("canvas-hover-identity-hud");
  expect(hud).toHaveTextContent("foreign");
  expect(hud).toHaveTextContent("src/Foreign.tsx");
  expect(hud).toHaveTextContent("Double-click to open");
  fireEvent.click(surface, { clientX: 20, clientY: 20 });
  expect(onSelectLayer).toHaveBeenCalledWith(foreignLayerId, 0);
  expect(onOpenLayerOwner).not.toHaveBeenCalled();

  fireEvent.doubleClick(surface, { clientX: 20, clientY: 20 });
  expect(onOpenLayerOwner).toHaveBeenCalledWith("foreign", foreignLayerId, 0);

  fireEvent.mouseMove(document.body);
  expect(screen.queryByTestId("canvas-hover-identity-hud")).not.toBeInTheDocument();
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

it("uses the bottom HUD for safe Preview, temporary Play, and isolated Design", async () => {
  const onModeChange = vi.fn();
  const onReturnToPreview = vi.fn();
  const entry = previewEntry("context", async () => previewDefinition("Context"));
  const view = render(
    <SourcePreviewFrame
      device="desktop"
      entry={entry}
      mode="design"
      runtime="react"
      styles={[]}
      workspaceMode="preview"
      onModeChange={onModeChange}
      onReturnToPreview={onReturnToPreview}
    />,
  );

  expect(screen.getByLabelText("Canvas context")).toHaveTextContent("Preview");
  expect(screen.queryByRole("button", { name: "Design mode" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Play interactive preview" }));
  expect(onModeChange).toHaveBeenCalledWith("play");

  view.rerender(
    <SourcePreviewFrame
      device="desktop"
      entry={entry}
      mode="design"
      runtime="react"
      styles={[]}
      workspaceMode="design"
      onModeChange={onModeChange}
      onReturnToPreview={onReturnToPreview}
    />,
  );
  expect(screen.getByLabelText("Canvas context")).toHaveTextContent("Design · context");
  await userEvent.click(screen.getByRole("button", { name: "Back to app preview" }));
  expect(onReturnToPreview).toHaveBeenCalledOnce();
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

it("centers an explicitly opened component inside the static canvas", async () => {
  const markup = await renderStaticSourcePreviewMarkup({
    caseName: "default",
    centered: true,
    definition: previewDefinition("Centered component"),
    entry: previewEntry("centered", async () => previewDefinition("unused")),
    matrix: false,
  });
  const container = document.createElement("div");
  container.innerHTML = markup;
  const layout = container.querySelector<HTMLElement>("div");

  expect(layout).toHaveStyle({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    minHeight: "100%",
    width: "100%",
  });
  expect(container).toHaveTextContent("Centered component");
});

it("renders the source-owned preview environment without styling the component", async () => {
  const markup = await renderStaticSourcePreviewMarkup({
    caseName: "default",
    centered: true,
    definition: {
      ...previewDefinition("Framed component"),
      preview: {
        background: "#141518",
        height: 320,
        layout: "center",
        padding: 24,
        width: "min(100%, 480px)",
      },
    },
    entry: previewEntry("framed", async () => previewDefinition("unused")),
    matrix: false,
  });
  const container = document.createElement("div");
  container.innerHTML = markup;
  const environment = container.querySelector<HTMLElement>("[data-design-space-preview-environment]");
  const component = environment?.querySelector("p");

  expect(environment).toHaveStyle({
    alignItems: "center",
    background: "#141518",
    display: "flex",
    height: "320px",
    justifyContent: "center",
    padding: "24px",
    width: "min(100%, 480px)",
  });
  expect(component).toHaveTextContent("Framed component");
  expect(component).not.toHaveAttribute("style");
});

it("renders empty typed slots as purple canvas insertion targets", async () => {
  const slot: SourceWorkspaceLayer = {
    id: "slot.content",
    label: "content",
    kind: "slot",
    source: { start: 10, end: 10 },
    children: [],
    slot: {
      contract: { name: "content", type: "ComponentSlot<Panel>", required: true, multiple: false, accepts: ["Panel"], min: 1, max: 1 },
      validity: "missing",
      received: [],
      edit: { kind: "missing-property", insertAt: 10 },
    },
  };
  const entry = {
    ...previewEntry("shell", async () => previewDefinition("unused")),
    slots: [slot.slot!.contract],
  };
  const markup = await renderStaticSourcePreviewMarkup({
    caseName: "default",
    definition: {
      ...previewDefinition("unused"),
      defaults: { slots: {} },
      render: (props) => <section>{(props.slots as Record<string, ReactNode>).content}</section>,
    },
    entry,
    matrix: false,
    slotLayers: [slot],
  });
  const container = document.createElement("div");
  container.innerHTML = markup;
  const target = container.querySelector<HTMLElement>('[data-design-space-source-slot-name="content"]');
  expect(target).toBeEmptyDOMElement();
  expect(target).toHaveAttribute("data-design-space-source-layer-id", slot.id);
  expect(target?.style.backgroundImage).toContain("linear-gradient");
  expect(target?.style.borderColor).toContain("192");
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
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Design invalid");
  expect(alert).toHaveTextContent("The component design could not be loaded.");
  expect(screen.getByText("Design compile failed")).toHaveClass("text-red-300/70");
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

it("distinguishes repeated DOM occurrences created from the same source layer", () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const staging = frameDocument.createElement("div");
  staging.id = "design-space-preview-root";
  const stagingFirst = frameDocument.createElement("button");
  const stagingSecond = frameDocument.createElement("button");
  stagingFirst.dataset.designSpaceSourceLayerId = "accordion-trigger";
  stagingSecond.dataset.designSpaceSourceLayerId = "accordion-trigger";
  staging.append(stagingFirst, stagingSecond);
  const output = frameDocument.createElement("div");
  output.id = "design-space-preview-root";
  const first = frameDocument.createElement("button");
  const second = frameDocument.createElement("button");
  first.dataset.designSpaceSourceLayerId = "accordion-trigger";
  second.dataset.designSpaceSourceLayerId = "accordion-trigger";
  output.append(first, second);
  frameDocument.body.append(staging, output);
  Object.defineProperty(frameDocument.documentElement, "clientWidth", { configurable: true, value: 100 });
  Object.defineProperty(frameDocument.documentElement, "clientHeight", { configurable: true, value: 100 });
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  frameDocument.elementFromPoint = vi.fn(() => second);

  expect(sourceLayerHitAtPreviewPoint(frame, { clientX: 20, clientY: 70 }, new Set(["accordion-trigger"])))
    .toEqual({ layerId: "accordion-trigger", occurrence: 1 });
  expect(sourceLayerElement(output, "accordion-trigger", 1)).toBe(second);

  frame.remove();
});

it("navigates repeated runtime instances without duplicating the source layer", async () => {
  const onChange = vi.fn();
  render(<SourceInstanceNavigator count={3} index={0} onChange={onChange} />);

  expect(screen.getByTestId("source-instance-navigator")).toHaveTextContent("Instance 1 / 3");
  await userEvent.click(screen.getByRole("button", { name: "Next instance" }));
  expect(onChange).toHaveBeenCalledWith(1);
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

it("mounts selection chrome outside the rendered preview DOM without changing its layout tree", () => {
  const canvas = document.createElement("main");
  canvas.dataset.designSpaceCanvasViewport = "";
  const frame = document.createElement("iframe");
  canvas.append(frame);
  document.body.append(canvas);
  const previewDocument = frame.contentDocument!;
  const output = previewDocument.createElement("div");
  output.innerHTML = '<section data-design-space-source-layer-id="selected"><span>Rendered content</span></section>';
  previewDocument.body.append(output);
  const renderedMarkup = output.innerHTML;
  const dispose = mountSourceLayerSelection(output, "selected", "layer", undefined, undefined, 0, "Selected layer");
  const overlay = document.querySelector<HTMLElement>("[data-design-space-source-selection]")!;
  const label = overlay.querySelector<HTMLElement>("[data-design-space-source-outline-label='selection']");

  expect(label).toHaveTextContent("Selected layer");
  expect(label).toHaveStyle({ backgroundColor: "", color: "rgb(13, 153, 255)" });
  expect(overlay.parentElement).toHaveAttribute("id", "design-space-canvas-overlays");
  expect(overlay.parentElement?.parentElement).toBe(canvas);
  expect(overlay.parentElement).toHaveStyle({ overflow: "hidden", position: "absolute", zIndex: "10" });
  expect(output.innerHTML).toBe(renderedMarkup);
  expect(previewDocument.querySelector("[data-design-space-source-selection]")).toBeNull();
  expect(overlay.style.position).toBe("absolute");
  expect(overlay.style.borderWidth).toBe("0px");
  expect(overlay.style.boxShadow).toContain("inset");

  dispose();
  canvas.remove();
});

it("uses the component color for selected component outlines and labels", () => {
  const output = document.createElement("div");
  document.body.append(output);
  const dispose = mountSourceLayerSelection(output, "selected-component", "component", undefined, undefined, 0, "WorkspaceStatus");
  const overlay = document.querySelector<HTMLElement>("[data-design-space-source-selection]")!;
  const label = overlay.querySelector<HTMLElement>("[data-design-space-source-outline-label='selection']");

  expect(label).toHaveTextContent("WorkspaceStatus");
  expect(label).toHaveStyle({ color: "rgb(167, 139, 250)" });
  expect(overlay.style.boxShadow).toContain("#a78bfa");

  dispose();
  output.remove();
});

it("renders hover feedback as a lightweight outline without selection handles", () => {
  const output = document.createElement("div");
  document.body.append(output);
  const dispose = mountSourceLayerHover(output, "hovered", undefined, 0, {
    label: "ForeignPanel",
    relativePath: "src/components/ForeignPanel.tsx",
  });
  const overlay = document.querySelector<HTMLElement>("[data-design-space-source-hover]")!;
  const label = overlay.querySelector<HTMLElement>("[data-design-space-source-outline-label='hover']");

  expect(overlay.dataset.designSpaceSourceHover).toBe("hovered");
  expect(label).toHaveTextContent("ForeignPanel");
  expect(label).toHaveStyle({ backgroundColor: "", color: "rgb(167, 139, 250)" });
  expect(overlay.style.boxShadow).toContain("#a78bfa");
  expect(overlay.style.borderWidth).toBe("0px");
  expect(overlay.parentElement).toHaveAttribute("id", "design-space-canvas-overlays");
  expect(document.querySelector("[data-design-space-source-owner-tooltip]")).toBeNull();

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

it("reuses source geometry while only the host canvas moves", () => {
  const canvas = document.createElement("main");
  canvas.dataset.designSpaceCanvasViewport = "";
  const frame = document.createElement("iframe");
  canvas.append(frame);
  document.body.append(canvas);
  const previewDocument = frame.contentDocument!;
  const output = previewDocument.createElement("div");
  const root = previewDocument.createElement("div");
  const child = previewDocument.createElement("span");
  root.dataset.designSpaceSourceLayerId = "selected";
  root.append(child);
  output.append(root);
  previewDocument.body.append(output);
  root.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect);
  child.getBoundingClientRect = vi.fn(() => ({ left: 20, top: 30, width: 100, height: 40 }) as DOMRect);
  const ownerWindow = previewDocument.defaultView!;
  const requestFrame = vi.spyOn(ownerWindow, "requestAnimationFrame")
    .mockImplementation((callback) => {
      callback(0);
      return 1;
    });

  const dispose = mountSourceLayerSelection(output, "selected", "layer");
  expect(child.getBoundingClientRect).toHaveBeenCalledOnce();

  document.dispatchEvent(new Event("scroll"));

  expect(child.getBoundingClientRect).toHaveBeenCalledOnce();
  dispose();
  requestFrame.mockRestore();
  canvas.remove();
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

it("applies visual drafts only to the selected rendered occurrence", () => {
  const output = document.createElement("div");
  output.innerHTML = [
    '<button data-design-space-source-layer-id="loop-button">First</button>',
    '<button data-design-space-source-layer-id="loop-button">Second</button>',
  ].join("");

  expect(applySourceLayerClassNameById(output, "loop-button", "selected", 1)).toBe(true);
  expect(applySourceLayerTextById(output, "loop-button", "Changed", 1)).toBe(true);
  expect(output.children[0]).not.toHaveClass("selected");
  expect(output.children[0]).toHaveTextContent("First");
  expect(output.children[1]).toHaveClass("selected");
  expect(output.children[1]).toHaveTextContent("Changed");
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
