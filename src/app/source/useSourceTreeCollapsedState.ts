import { useCallback, useEffect, useMemo, useState } from "react";

import type { SourceFocusRow } from "./source-focus-tree";
import { initiallyCollapsedSourceBranches } from "./source-focus-tree";
import {
  loadSourceTreeCollapsedBranches,
  saveSourceTreeCollapsedBranches,
  sourceTreeUiStorageKey,
  sourceWorkspaceBrowserStorage,
} from "./source-workspace-ui-state";

export function useSourceTreeCollapsedState(
  rows: readonly SourceFocusRow[],
  focusId: string | undefined,
  namespace: string | undefined,
) {
  const storageKey = namespace ? sourceTreeUiStorageKey(namespace) : "local";
  const stored = useMemo(
    () => namespace
      ? loadSourceTreeCollapsedBranches(sourceWorkspaceBrowserStorage(), namespace)
      : undefined,
    [namespace],
  );
  const fallback = useMemo(
    () => initiallyCollapsedSourceBranches(rows, focusId),
    [focusId, rows],
  );
  const [overrides, setOverrides] = useState<Record<string, ReadonlySet<string>>>({});
  const collapsed = overrides[storageKey] ?? stored ?? fallback;

  const setCollapsed = useCallback((update: (current: ReadonlySet<string>) => ReadonlySet<string>) => {
    setOverrides((current) => ({
      ...current,
      [storageKey]: update(current[storageKey] ?? stored ?? fallback),
    }));
  }, [fallback, storageKey, stored]);

  useEffect(() => {
    if (!namespace) return;
    saveSourceTreeCollapsedBranches(sourceWorkspaceBrowserStorage(), namespace, collapsed);
  }, [collapsed, namespace]);

  return [collapsed, setCollapsed] as const;
}
