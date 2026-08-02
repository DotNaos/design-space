import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { createIndexedDbSourceDraftPersistence, createMemorySourceDraftPersistence } from "./source-draft-persistence";
import { createSourceDraftWorkspace, sourceDraftKey } from "./source-draft-workspace";
import type {
  SourceDraftLocation,
  SourceDraftWorkspaceSnapshot,
  SourceDraftWorkspaceStore,
} from "./source-draft-workspace-types";

let defaultWorkspace: SourceDraftWorkspaceStore | undefined;

export function getDefaultSourceDraftWorkspace(): SourceDraftWorkspaceStore {
  defaultWorkspace ??= createSourceDraftWorkspace({
    persistence: typeof indexedDB === "undefined"
      ? createMemorySourceDraftPersistence()
      : createIndexedDbSourceDraftPersistence(),
  });
  return defaultWorkspace;
}

export function useSourceDraftWorkspace<TPrepared = unknown>(
  workspace: SourceDraftWorkspaceStore<TPrepared> = getDefaultSourceDraftWorkspace() as SourceDraftWorkspaceStore<TPrepared>,
): { state: SourceDraftWorkspaceSnapshot; workspace: SourceDraftWorkspaceStore<TPrepared> } {
  const state = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot, workspace.getSnapshot);
  useEffect(() => {
    void workspace.hydrate();
  }, [workspace]);
  return useMemo(() => ({ state, workspace }), [state, workspace]);
}

export function useSourceDraftFile<TPrepared = unknown>(
  workspace: SourceDraftWorkspaceStore<TPrepared>,
  location: SourceDraftLocation | undefined,
) {
  const { state } = useSourceDraftWorkspace(workspace);
  const [loadingKey, setLoadingKey] = useState<string>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const key = location ? sourceDraftKey(location) : undefined;
  const entry = key ? state.entries.find((candidate) => candidate.key === key) : undefined;
  const scope = location?.scope;
  const rootId = location?.rootId;
  const fileId = location?.fileId;

  useEffect(() => {
    if (!key || !scope || !rootId || !fileId || entry) return;
    let current = true;
    setLoadingKey(key);
    setFailure(undefined);
    void workspace.readFromSource({ scope, rootId, fileId }).catch((reason: unknown) => {
      if (current) setFailure({
        key,
        message: reason instanceof Error ? reason.message : "The source file could not be opened.",
      });
    }).finally(() => {
      setLoadingKey((loading) => loading === key ? undefined : loading);
    });
    return () => {
      current = false;
    };
  }, [entry, fileId, key, rootId, scope, workspace]);

  const setDraft = useCallback((source: string) => {
    if (location) workspace.edit(location, source);
  }, [location, workspace]);
  const undo = useCallback(() => {
    if (location) workspace.undo(location);
  }, [location, workspace]);
  const redo = useCallback(() => {
    if (location) workspace.redo(location);
  }, [location, workspace]);
  const reset = useCallback(() => {
    if (location) workspace.reset(location);
  }, [location, workspace]);

  return {
    entry,
    draft: entry?.draftSource ?? "",
    dirty: entry?.dirty ?? false,
    snapshot: entry ? {
      fileId: entry.fileId,
      label: entry.label,
      source: entry.baseSource,
      version: entry.baseVersion,
    } : undefined,
    loading: loadingKey === key,
    error: failure && failure.key === key ? failure.message : undefined,
    canUndo: Boolean(entry?.history.length),
    canRedo: Boolean(entry?.future.length),
    setDraft,
    undo,
    redo,
    reset,
  };
}

export type SourceDraftFileEditor = ReturnType<typeof useSourceDraftFile>;
