import { useEffect, useMemo, useRef, useState } from "react";

import type { MobilePane } from "../shell/MobileDock";
import type { WorkspaceActivity } from "../shell/WorkspaceActivityRail";
import type { SourcePreviewMode, SourceWorkspaceMode } from "./source-layer-design";
import {
  loadSourceWorkspaceUiState,
  saveSourceWorkspaceUiState,
  sourceWorkspaceBrowserStorage,
} from "./source-workspace-ui-state";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

export function useSourceWorkspaceUiState(options: {
  defaultFocusId?: string;
  defaultLibraryComponent?: string;
  defaultSelection?: SourceWorkspaceSelection;
  fileIds: ReadonlySet<string>;
  focusIds: ReadonlySet<string>;
  nodeIds: ReadonlySet<string>;
  projectId: string;
  targetId?: string;
}) {
  const restored = useMemo(
    () => loadSourceWorkspaceUiState(sourceWorkspaceBrowserStorage(), options.projectId),
    [options.projectId],
  );
  const restoredSelection = restored.selection
    && options.nodeIds.has(restored.selection.nodeId)
    && (!restored.selection.occurrenceId || options.focusIds.has(restored.selection.occurrenceId))
    ? restored.selection
    : options.defaultSelection;
  const validSelection = (candidate: SourceWorkspaceSelection | undefined) => candidate
    && options.nodeIds.has(candidate.nodeId)
    && (!candidate.occurrenceId || options.focusIds.has(candidate.occurrenceId))
    ? candidate
    : undefined;
  const [activity, setActivity] = useState<WorkspaceActivity>(restored.activity ?? "app");
  const [appCodeHeight, setAppCodeHeight] = useState<number | undefined>(restored.appCodeHeight);
  const [appCodeOpen, setAppCodeOpen] = useState(
    restored.appCodeOpen ?? (restored.activity === "app" && restored.rightMode === "code"),
  );
  const [mobilePane, setMobilePane] = useState<MobilePane>(restored.mobilePane ?? "canvas");
  const [selection, setSelection] = useState<SourceWorkspaceSelection | undefined>(restoredSelection);
  const [focusId, setFocusId] = useState<string | undefined>(
    restored.focusId && options.focusIds.has(restored.focusId)
      ? restored.focusId
      : options.defaultFocusId,
  );
  const [designRootId, setDesignRootId] = useState<string | undefined>(
    restored.designRootId && options.focusIds.has(restored.designRootId)
      ? restored.designRootId
      : undefined,
  );
  const [designSelection, setDesignSelection] = useState<SourceWorkspaceSelection | undefined>(
    validSelection(restored.designSelection),
  );
  const [previewSelection, setPreviewSelection] = useState<SourceWorkspaceSelection | undefined>(
    validSelection(restored.previewSelection) ?? restoredSelection,
  );
  const [workspaceMode, setWorkspaceMode] = useState<SourceWorkspaceMode>(restored.workspaceMode ?? "design");
  const [workspaceSurface, setWorkspaceSurface] = useState<"app" | "library">(
    restored.workspaceSurface ?? (restored.activity === "library" ? "library" : "app"),
  );
  const [previewRuntime, setPreviewRuntime] = useState<"static" | "play">("static");
  const [rightMode, setRightMode] = useState<"code" | "design">(restored.rightMode ?? "design");
  const [codeDocument, setCodeDocument] = useState<"source" | "design">(restored.codeDocument ?? "source");
  const [designCases, setDesignCases] = useState<Readonly<Record<string, string>>>(restored.designCases ?? {});
  const [canvasMode, setCanvasMode] = useState<SourcePreviewMode>(
    restored.canvasMode === "play" ? "design" : restored.canvasMode ?? "design",
  );
  const [selectedProjectFileId, setSelectedProjectFileId] = useState<string | undefined>(
    restored.selectedProjectFileId && options.fileIds.has(restored.selectedProjectFileId)
      ? restored.selectedProjectFileId
      : undefined,
  );
  const [selectedLibraryComponent, setSelectedLibraryComponent] = useState(
    restored.selectedLibraryComponent ?? options.defaultLibraryComponent,
  );
  const [selectedLibraryLayerId, setSelectedLibraryLayerId] = useState<string | undefined>(
    restored.selectedLibraryLayerId,
  );
  const currentProjectId = useRef(options.projectId);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (currentProjectId.current === options.projectId) return;
    currentProjectId.current = options.projectId;
    skipNextSave.current = true;
    setActivity(restored.activity ?? "app");
    setAppCodeHeight(restored.appCodeHeight);
    setAppCodeOpen(restored.appCodeOpen ?? (restored.activity === "app" && restored.rightMode === "code"));
    setMobilePane(restored.mobilePane ?? "canvas");
    setSelection(restoredSelection);
    setFocusId(
      restored.focusId && options.focusIds.has(restored.focusId)
        ? restored.focusId
        : options.defaultFocusId,
    );
    setDesignRootId(
      restored.designRootId && options.focusIds.has(restored.designRootId)
        ? restored.designRootId
        : undefined,
    );
    setDesignSelection(validSelection(restored.designSelection));
    setPreviewSelection(validSelection(restored.previewSelection) ?? restoredSelection);
    setWorkspaceMode(restored.workspaceMode ?? "design");
    setWorkspaceSurface(restored.workspaceSurface ?? (restored.activity === "library" ? "library" : "app"));
    setPreviewRuntime("static");
    setRightMode(restored.rightMode ?? "design");
    setCodeDocument(restored.codeDocument ?? "source");
    setDesignCases(restored.designCases ?? {});
    setCanvasMode(restored.canvasMode === "play" ? "design" : restored.canvasMode ?? "design");
    setSelectedProjectFileId(
      restored.selectedProjectFileId && options.fileIds.has(restored.selectedProjectFileId)
        ? restored.selectedProjectFileId
        : undefined,
    );
    setSelectedLibraryComponent(restored.selectedLibraryComponent ?? options.defaultLibraryComponent);
    setSelectedLibraryLayerId(restored.selectedLibraryLayerId);
  }, [options.projectId, restored]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveSourceWorkspaceUiState(sourceWorkspaceBrowserStorage(), options.projectId, {
      activity,
      appCodeHeight,
      appCodeOpen,
      canvasMode: canvasMode === "play" ? "design" : canvasMode,
      codeDocument,
      designCases,
      designRootId,
      designSelection,
      focusId,
      mobilePane,
      previewSelection,
      rightMode,
      selectedLibraryComponent,
      selectedLibraryLayerId,
      selectedProjectFileId,
      selection,
      targetId: options.targetId,
      workspaceMode,
      workspaceSurface,
    });
  }, [
    activity,
    appCodeHeight,
    appCodeOpen,
    canvasMode,
    codeDocument,
    designCases,
    designRootId,
    designSelection,
    focusId,
    mobilePane,
    options.projectId,
    previewSelection,
    rightMode,
    selectedLibraryComponent,
    selectedLibraryLayerId,
    selectedProjectFileId,
    selection,
    options.targetId,
    workspaceMode,
    workspaceSurface,
  ]);

  useEffect(() => {
    if (workspaceMode === "design" && previewRuntime !== "static") setPreviewRuntime("static");
  }, [previewRuntime, workspaceMode]);

  return {
    activity,
    appCodeHeight,
    appCodeOpen,
    canvasMode,
    codeDocument,
    designCases,
    designRootId,
    designSelection,
    focusId,
    mobilePane,
    previewRuntime,
    previewSelection,
    rightMode,
    selectedLibraryComponent,
    selectedLibraryLayerId,
    selectedProjectFileId,
    selection,
    workspaceMode,
    workspaceSurface,
    setActivity,
    setAppCodeHeight,
    setAppCodeOpen,
    setCanvasMode,
    setCodeDocument,
    setDesignCases,
    setDesignRootId,
    setDesignSelection,
    setFocusId,
    setMobilePane,
    setPreviewRuntime,
    setPreviewSelection,
    setRightMode,
    setSelectedLibraryComponent,
    setSelectedLibraryLayerId,
    setSelectedProjectFileId,
    setSelection,
    setWorkspaceMode,
    setWorkspaceSurface,
  };
}
