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
  }, [key, visibility.left, visibility.right]);

  const toggle = (side: keyof WorkspacePanelVisibility) => {
    setOverrides((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? restored),
        [side]: !(current[key] ?? restored)[side],
      },
    }));
  };

  return { visibility, toggle };
}

function browserStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
