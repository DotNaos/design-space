import { expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceTarget } from "../../shared/source-workspace";
import { sourceTreeNodes } from "./source-workspace-tree";
import { sourceDeviceTransition, sourceTargetScopedInteractionReset } from "./source-workspace-transition";

const entry = (id: string, device: "desktop" | "tablet", relativePath: string): RuntimeSourceWorkspaceEntry => ({
  id, label: "App", area: "layout", device, fileId: `${id}-file`, relativePath, exportName: "default",
  props: [], slots: [], findings: [], source: { start: 0, end: 1 }, component: () => null,
  targetId: "web", manifestDevices: [device],
});

it("clears target-scoped feedback and canvas interaction state on a target change", () => {
  expect(sourceTargetScopedInteractionReset()).toEqual({
    codeAnnotations: [],
    codeContexts: [],
    hoveredSelection: undefined,
    layerMetrics: undefined,
    canvasRevealRequest: undefined,
  });
});

it("re-resolves a separate device root without retaining stale layer or source state", () => {
  const desktop = entry("desktop-root", "desktop", "clients/web/src/App.desktop.tsx");
  const tablet = entry("tablet-root", "tablet", "clients/web/src/App.tablet.tsx");
  const target: SourceWorkspaceTarget = {
    id: "web", runtime: "react", sourceRoot: "clients/web", entrypoint: "clients/web/src/main.tsx",
    devices: [
      { id: "desktop", entryId: desktop.id, root: { source: desktop.relativePath, export: "default" } },
      { id: "tablet", entryId: tablet.id, root: { source: tablet.relativePath, export: "default" } },
    ],
  };
  const nodes = sourceTreeNodes({
    adapter: "app-manifest", runtime: "react", sourceRoot: "clients/web", devices: [], styles: [],
    targets: [target], entries: [desktop, tablet],
  }, target.id);
  const next = sourceDeviceTransition(nodes, target, "tablet", "layout:app");

  expect(next?.selection).toMatchObject({ device: "tablet", kind: "component" });
  expect(next?.selection).not.toHaveProperty("layerId");
  expect(next?.selection).not.toHaveProperty("slotName");
  expect(next?.selection).not.toHaveProperty("renderedLayerOccurrence");
  expect(next?.entryId).toBe("tablet-root");
});
