import { expect, it } from "vitest";

import {
  loadSourceTreeCollapsedBranches,
  loadSourceWorkspaceUiState,
  saveSourceTreeCollapsedBranches,
  saveSourceWorkspaceUiState,
  sourceTreeUiStorageKey,
  sourceWorkspaceUiStorageKey,
  type SourceWorkspaceUiState,
} from "./source-workspace-ui-state";

it("round-trips project-scoped editor state", () => {
  const storage = memoryStorage();
  const state: SourceWorkspaceUiState = {
    activity: "app",
    appCodeHeight: 360,
    appCodeOpen: true,
    canvasMode: "design",
    codeDocument: "design",
    designCases: {
      "src/app/components/Button/Button.design.tsx": "loading",
    },
    designRootId: "root.0:layout/child",
    designSelection: {
      device: "desktop",
      kind: "component",
      nodeId: "components:Button",
      occurrenceId: "root.0:layout/child",
    },
    focusId: "root.0:layout/child",
    mobilePane: "canvas",
    previewSelection: {
      device: "mobile",
      kind: "html",
      layerId: "button-label",
      nodeId: "components:Button",
      occurrenceId: "root.0:layout/child",
      renderedLayerOccurrence: 2,
      sourceNodeId: "components:Button",
    },
    rightMode: "code",
    selectedLibraryComponent: "Button",
    selectedLibraryLayerId: "button-label",
    selectedProjectFileId: "src/app/App.tsx",
    selection: {
      device: "mobile",
      kind: "html",
      layerId: "button-label",
      nodeId: "components:Button",
      occurrenceId: "root.0:layout/child",
      renderedLayerOccurrence: 2,
      sourceNodeId: "components:Button",
    },
    targetId: "web",
    workspaceMode: "design",
    workspaceSurface: "app",
  };

  saveSourceWorkspaceUiState(storage, "project alpha", state);

  expect(loadSourceWorkspaceUiState(storage, "project alpha")).toEqual(state);
  expect(loadSourceWorkspaceUiState(storage, "project beta")).toEqual({});
  expect(storage.getItem(sourceWorkspaceUiStorageKey("project alpha"))).toContain("\"version\":2");
});

it("migrates the version 1 device selection and adds a target on the next save", () => {
  const storage = memoryStorage();
  storage.setItem("design-space:source-workspace:v1:project", JSON.stringify({
    version: 1,
    selection: { device: "tablet", nodeId: "layout:app" },
    workspaceMode: "preview",
  }));

  expect(loadSourceWorkspaceUiState(storage, "project")).toEqual({
    selection: { device: "tablet", nodeId: "layout:app" },
    workspaceMode: "preview",
  });

  saveSourceWorkspaceUiState(storage, "project", {
    activity: "app",
    appCodeOpen: false,
    canvasMode: "design",
    codeDocument: "source",
    designCases: {},
    mobilePane: "canvas",
    rightMode: "design",
    selection: { device: "tablet", nodeId: "layout:app" },
    targetId: "web",
    workspaceMode: "preview",
    workspaceSurface: "app",
  });
  expect(loadSourceWorkspaceUiState(storage, "project")).toMatchObject({
    targetId: "web",
    selection: { device: "tablet" },
  });
});

it("ignores corrupt or unsupported editor state instead of breaking startup", () => {
  const storage = memoryStorage();
  storage.setItem(sourceWorkspaceUiStorageKey("project"), JSON.stringify({
    version: 2,
    activity: "unknown",
    canvasMode: "broken",
    rightMode: "design",
    selection: { device: "watch", nodeId: 42 },
  }));

  expect(loadSourceWorkspaceUiState(storage, "project")).toEqual({ rightMode: "design" });

  storage.setItem(sourceWorkspaceUiStorageKey("project"), "{");
  expect(loadSourceWorkspaceUiState(storage, "project")).toEqual({});
});

it("never restores the temporary interactive canvas state", () => {
  const storage = memoryStorage();
  storage.setItem(sourceWorkspaceUiStorageKey("project"), JSON.stringify({
    version: 2,
    canvasMode: "play",
    workspaceMode: "preview",
  }));

  expect(loadSourceWorkspaceUiState(storage, "project")).toEqual({
    canvasMode: "design",
    workspaceMode: "preview",
  });
});

it("round-trips collapsed tree branches independently per tree", () => {
  const storage = memoryStorage();
  saveSourceTreeCollapsedBranches(storage, "project:app:desktop", new Set(["root", "root/content"]));

  expect(loadSourceTreeCollapsedBranches(storage, "project:app:desktop"))
    .toEqual(new Set(["root", "root/content"]));
  expect(loadSourceTreeCollapsedBranches(storage, "project:app:mobile")).toBeUndefined();
  expect(storage.getItem(sourceTreeUiStorageKey("project:app:desktop"))).toContain("\"collapsed\"");
});

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
