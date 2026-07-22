import { expect, it } from "vitest";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { sourceCanvasVisualLayer } from "./source-canvas-selection";

const htmlLayer: SourceWorkspaceLayer = {
  id: "panel-root",
  kind: "html",
  label: "section",
  source: { start: 40, end: 100 },
  children: [],
};

const entry: SourceWorkspaceEntry = {
  id: "panel",
  label: "Panel",
  area: "components",
  device: "desktop",
  fileId: "panel-file",
  relativePath: "src/components/Panel.tsx",
  exportName: "Panel",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 120 },
  layers: [{
    id: "content-slot",
    kind: "slot",
    label: "content",
    source: { start: 20, end: 30 },
    children: [htmlLayer],
  }],
};

it("uses the component's first authored HTML layer for its visual inspector", () => {
  expect(sourceCanvasVisualLayer(entry, undefined)).toBe(htmlLayer);
});

it("keeps an explicitly selected canvas layer", () => {
  const selected = { ...htmlLayer, id: "selected" };
  expect(sourceCanvasVisualLayer(entry, selected)).toBe(selected);
});
