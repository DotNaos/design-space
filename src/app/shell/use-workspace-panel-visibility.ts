import { useEffect, useMemo, useState } from "react";

import {
  loadWorkspacePanelVisibility,
  saveWorkspacePanelVisibility,
  workspacePanelVisibilityStorageKey,
  type WorkspacePanelNamespace,
  type WorkspacePanelVisibility,
} from "./workspace-panel-state";

export function useWorkspacePanelVisibility(namespace: WorkspacePanelNamespace) {
  const key = useMemo(
    () => workspacePanelVisibilityStorageKey(namespace),
    [namespace.documentId, namespace.projectId],
  );
  const restored = useMemo(() => loadWorkspacePanelVisibility(browserStorage(), key), [key]);
  const [overrides, setOverrides] = useState<Record<string, WorkspacePanelVisibility>>({});
  const visibility = overrides[key] ?? restored;

  useEffect(() => {
    saveWorkspacePanelVisibility(browserStorage(), key, visibility);
  }, [key, visibility.expanded, visibility.left, visibility.right]);

  const setVisible = (side: "left" | "right", visible: boolean) => {
    setOverrides((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? restored),
        [side]: visible,
        expanded: visible ? (current[key] ?? restored).expanded : (current[key] ?? restored).expanded === side ? null : (current[key] ?? restored).expanded,
      },
    }));
  };

  const setExpanded = (side: "left" | "right" | null) => {
    setOverrides((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? restored),
        ...(side ? { [side]: true } : {}),
        expanded: side,
      },
    }));
  };

  const toggle = (side: "left" | "right") => {
    setVisible(side, !visibility[side]);
  };

  return { visibility, setVisible, setExpanded, toggle };
}

function browserStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
