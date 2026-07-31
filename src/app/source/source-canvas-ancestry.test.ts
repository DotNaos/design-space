import { expect, it } from "vitest";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import { sourceCanvasAncestry } from "./source-canvas-ancestry";

it("describes the selected canvas layer from the application root", () => {
  const app = occurrence("app", "App");
  const shell = occurrence("shell", "WorkspaceShell", "app");
  const content: SourceWorkspaceLayer = {
    children: [],
    id: "content-slot",
    kind: "slot",
    label: "content",
    slot: {
      contract: { accepts: [], max: 1, min: 0, multiple: false, name: "content", required: false, type: "ReactNode" },
      edit: { insertAt: 1, kind: "single" },
      received: [],
      validity: "optional",
    },
    source: { start: 0, end: 1 },
  };
  const graph: SourceFocusGraph = {
    roots: [app.id],
    occurrences: new Map([[app.id, app], [shell.id, shell]]),
  };

  expect(sourceCanvasAncestry(graph, shell.id, content)).toEqual([
    { id: "app", kind: "component", label: "App" },
    { id: "shell", kind: "component", label: "WorkspaceShell" },
    { id: "content-slot", kind: "slot", label: "slot:content" },
  ]);
});

it("stops safely when an occurrence graph contains a cycle", () => {
  const app = occurrence("app", "App", "shell");
  const shell = occurrence("shell", "WorkspaceShell", "app");
  const graph: SourceFocusGraph = {
    roots: [app.id],
    occurrences: new Map([[app.id, app], [shell.id, shell]]),
  };

  expect(sourceCanvasAncestry(graph, shell.id)).toHaveLength(2);
});

function occurrence(id: string, label: string, parentId?: string): SourceOccurrence {
  return {
    children: [],
    id,
    node: {
      area: "layout",
      entries: [],
      id,
      implementations: {
        desktop: { requestedDevice: "desktop", state: "missing" },
        mobile: { requestedDevice: "mobile", state: "missing" },
        tablet: { requestedDevice: "tablet", state: "missing" },
      },
      label,
      uses: [],
    },
    parentId,
  };
}
