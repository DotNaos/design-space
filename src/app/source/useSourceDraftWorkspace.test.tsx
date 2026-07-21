import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import { createMemorySourceDraftPersistence } from "./source-draft-persistence";
import { createSourceDraftWorkspace } from "./source-draft-workspace";
import type { SourceDraftBase, SourceDraftLocation } from "./source-draft-workspace-types";
import { useSourceDraftFile, useSourceDraftWorkspace } from "./useSourceDraftWorkspace";

const location: SourceDraftLocation = { scope: "app", rootId: "/project", fileId: "src/Panel.tsx" };
const base: SourceDraftBase = {
  ...location,
  label: "Panel",
  path: "src/Panel.tsx",
  baseSource: "export const Panel = () => null",
  baseVersion: "v1",
};

it("subscribes React to the central workspace and exposes combined review totals", async () => {
  const workspace = createSourceDraftWorkspace({ persistence: createMemorySourceDraftPersistence() });
  const { result } = renderHook(() => useSourceDraftWorkspace(workspace));
  await waitFor(() => expect(result.current.state.hydration).toBe("ready"));

  act(() => {
    workspace.open(base);
    workspace.edit(location, "export const Panel = () => <div />");
  });
  expect(result.current.state).toMatchObject({ changeCount: 1, selectedChangeCount: 1 });
});

it("loads a file through the injected reader and adapts the draft to the existing editor shape", async () => {
  const workspace = createSourceDraftWorkspace({
    sourceAdapter: {
      read: async () => base,
      prepare: async () => ({ state: "valid", prepared: undefined }),
    },
  });
  const { result } = renderHook(() => useSourceDraftFile(workspace, location));

  await waitFor(() => expect(result.current.snapshot).toEqual({
    fileId: "src/Panel.tsx",
    label: "Panel",
    source: "export const Panel = () => null",
    version: "v1",
  }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({ draft: "export const Panel = () => null", dirty: false, loading: false });

  act(() => result.current.setDraft("export const Panel = () => <section />"));
  expect(result.current).toMatchObject({ dirty: true, canUndo: true, canRedo: false });
  act(() => result.current.undo());
  expect(result.current).toMatchObject({ draft: "export const Panel = () => null", dirty: false, canRedo: true });
  act(() => result.current.redo());
  expect(result.current.draft).toBe("export const Panel = () => <section />");
  act(() => result.current.reset());
  expect(result.current).toMatchObject({ draft: "export const Panel = () => null", dirty: false });
});
