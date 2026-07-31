import { expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { sourceEntrySlotLayers } from "./source-entry-layers";
import { renderStaticSourceDesignMarkup } from "./source-static-preview";

it("renders the selected component structure without rendering its child component", async () => {
  const child: SourceWorkspaceLayer = {
    id: "workspace-shell",
    label: "WorkspaceShell",
    kind: "component",
    source: { start: 12, end: 42 },
    children: [{
      id: "nested-runtime",
      label: "div",
      kind: "html",
      source: { start: 20, end: 30 },
      text: { value: "Nested application", start: 22, end: 40, syntax: "text" },
      children: [],
    }],
  };
  const entry = sourceEntry([child]);
  const slots = sourceEntrySlotLayers(entry);
  const markup = await renderStaticSourceDesignMarkup({ entry, slotLayers: slots });
  const container = document.createElement("div");
  container.innerHTML = markup;

  expect(container).toHaveTextContent("content");
  expect(container).toHaveTextContent("Empty slot");
  expect(container).not.toHaveTextContent("Nested application");
  expect(container.querySelector('[data-design-space-source-slot-name="content"]'))
    .toHaveAttribute("data-design-space-source-layer-id", slots[0]?.id);
});

it("renders mutually exclusive uses of the same component boundary as one slot", async () => {
  const entry = sourceEntry(["desktop", "tablet", "mobile"].map((id) => ({
    id: `workspace-shell-${id}`,
    label: "WorkspaceShell",
    kind: "component" as const,
    source: { start: 0, end: 10 },
    children: [],
  })));
  const slots = sourceEntrySlotLayers(entry);
  const markup = await renderStaticSourceDesignMarkup({ entry, slotLayers: slots });
  const container = document.createElement("div");
  container.innerHTML = markup;

  expect(slots).toHaveLength(1);
  expect(container.querySelectorAll('[data-design-space-source-slot-name="content"]')).toHaveLength(1);
});

it("keeps authored static HTML and gives leaf components a default slot", async () => {
  const entry = sourceEntry([{
    id: "button-shell",
    label: "button",
    kind: "html",
    className: { value: "rounded-lg", start: 2, end: 12 },
    source: { start: 0, end: 30 },
    text: { value: "Save", start: 14, end: 18, syntax: "text" },
    children: [],
  }]);
  const slots = sourceEntrySlotLayers(entry);
  const markup = await renderStaticSourceDesignMarkup({ entry, slotLayers: slots });
  const container = document.createElement("div");
  container.innerHTML = markup;

  expect(container.querySelector("button")).toHaveTextContent("Save");
  expect(container.querySelector("button")).toHaveClass("rounded-lg");
  expect(container.querySelector('[data-design-space-source-slot-name="content"]')).not.toBeNull();
});

function sourceEntry(layers: readonly SourceWorkspaceLayer[]): RuntimeSourceWorkspaceEntry {
  return {
    id: "app",
    label: "App",
    area: "pages",
    device: "desktop",
    fileId: "app-file",
    relativePath: "src/app/App.tsx",
    exportName: "App",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 50 },
    layers,
    component: () => {
      throw new Error("Design structure must not execute the component");
    },
  };
}
