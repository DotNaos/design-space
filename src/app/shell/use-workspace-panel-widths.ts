import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clampPanelWidth,
  clampPanelWidths,
  loadWorkspacePanelWidths,
  saveWorkspacePanelWidths,
  workspacePanelStorageKey,
  type WorkspacePanelBounds,
  type WorkspacePanelNamespace,
  type WorkspacePanelWidths,
} from "./workspace-panel-state";

type PanelSide = keyof WorkspacePanelWidths;

export function useWorkspacePanelWidths(namespace: WorkspacePanelNamespace, bounds: WorkspacePanelBounds) {
  const key = useMemo(
    () => workspacePanelStorageKey(namespace),
    [namespace.documentId, namespace.projectId],
  );
  const stored = useMemo(
    () => loadWorkspacePanelWidths(browserStorage(), key, bounds),
    [bounds.left.defaultWidth, bounds.left.maxWidth, bounds.left.minWidth, bounds.right.defaultWidth, bounds.right.maxWidth, bounds.right.minWidth, key],
  );
  const [overrides, setOverrides] = useState<Record<string, WorkspacePanelWidths>>({});
  const widths = clampPanelWidths(overrides[key] ?? stored, bounds);

  useEffect(() => {
    saveWorkspacePanelWidths(browserStorage(), key, widths);
  }, [key, widths.left, widths.right]);

  const setWidth = useCallback((side: PanelSide, width: number) => {
    setOverrides((current) => {
      const currentWidths = clampPanelWidths(current[key] ?? stored, bounds);
      return {
        ...current,
        [key]: {
          ...currentWidths,
          [side]: clampPanelWidth(width, bounds[side]),
        },
      };
    });
  }, [bounds, key, stored]);

  const setWidths = useCallback((next: WorkspacePanelWidths) => {
    setOverrides((current) => ({
      ...current,
      [key]: clampPanelWidths(next, bounds),
    }));
  }, [bounds, key]);

  const resetWidth = useCallback((side: PanelSide) => {
    setWidth(side, bounds[side].defaultWidth);
  }, [bounds, setWidth]);

  return { widths, setWidth, setWidths, resetWidth };
}

function browserStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
