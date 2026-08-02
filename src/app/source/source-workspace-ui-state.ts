import type { MobilePane } from "../shell/MobileDock";
import type { WorkspaceActivity } from "../shell/WorkspaceActivityRail";
import type { DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourcePreviewMode, SourceWorkspaceMode } from "./source-layer-design";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

export interface SourceWorkspaceUiState {
  appCodeHeight?: number;
  activity: WorkspaceActivity;
  appCodeOpen: boolean;
  canvasMode: SourcePreviewMode;
  codeDocument: "source" | "design";
  designCases: Readonly<Record<string, string>>;
  designRootId?: string;
  designSelection?: SourceWorkspaceSelection;
  focusId?: string;
  mobilePane: MobilePane;
  previewSelection?: SourceWorkspaceSelection;
  rightMode: "code" | "design";
  selectedLibraryComponent?: string;
  selectedLibraryLayerId?: string;
  selectedProjectFileId?: string;
  selection?: SourceWorkspaceSelection;
  workspaceMode: SourceWorkspaceMode;
}

type PersistedSourceWorkspaceUiState = Partial<SourceWorkspaceUiState> & {
  version: 1;
};

type PersistedSourceTreeState = {
  collapsed: readonly string[];
  version: 1;
};

const WORKSPACE_STORAGE_PREFIX = "design-space:source-workspace:v1";
const TREE_STORAGE_PREFIX = "design-space:source-tree:v1";
const activities: readonly WorkspaceActivity[] = ["app", "library", "files"];
const canvasModes: readonly SourcePreviewMode[] = ["design", "play"];
const workspaceModes: readonly SourceWorkspaceMode[] = ["preview", "design"];
const codeDocuments = ["source", "design"] as const;
const devices: readonly DesignSpaceDevice[] = ["desktop", "tablet", "mobile"];
const mobilePanes: readonly MobilePane[] = ["documents", "files", "tree", "canvas", "catalog", "inspect"];
const rightModes = ["code", "design"] as const;
const selectionKinds = ["component", "html", "slot"] as const;

export function sourceWorkspaceUiStorageKey(projectId: string) {
  return `${WORKSPACE_STORAGE_PREFIX}:${encodeURIComponent(projectId)}`;
}

export function sourceTreeUiStorageKey(namespace: string) {
  return `${TREE_STORAGE_PREFIX}:${encodeURIComponent(namespace)}`;
}

export function loadSourceWorkspaceUiState(
  storage: Pick<Storage, "getItem"> | undefined,
  projectId: string,
): Partial<SourceWorkspaceUiState> {
  const parsed = readJson(storage, sourceWorkspaceUiStorageKey(projectId));
  if (!isRecord(parsed) || parsed.version !== 1) return {};

  return {
    ...(isOneOf(parsed.activity, activities) ? { activity: parsed.activity } : {}),
    ...(validPanelHeight(parsed.appCodeHeight) ? { appCodeHeight: parsed.appCodeHeight } : {}),
    ...(typeof parsed.appCodeOpen === "boolean" ? { appCodeOpen: parsed.appCodeOpen } : {}),
    ...(isOneOf(parsed.canvasMode, canvasModes)
      ? { canvasMode: parsed.canvasMode === "play" ? "design" : parsed.canvasMode }
      : {}),
    ...(isOneOf(parsed.codeDocument, codeDocuments) ? { codeDocument: parsed.codeDocument } : {}),
    ...(stringRecord(parsed.designCases) ? { designCases: stringRecord(parsed.designCases) } : {}),
    ...(typeof parsed.designRootId === "string" ? { designRootId: parsed.designRootId } : {}),
    ...(sourceWorkspaceSelection(parsed.designSelection)
      ? { designSelection: sourceWorkspaceSelection(parsed.designSelection) }
      : {}),
    ...(typeof parsed.focusId === "string" ? { focusId: parsed.focusId } : {}),
    ...(isOneOf(parsed.mobilePane, mobilePanes) ? { mobilePane: parsed.mobilePane } : {}),
    ...(sourceWorkspaceSelection(parsed.previewSelection)
      ? { previewSelection: sourceWorkspaceSelection(parsed.previewSelection) }
      : {}),
    ...(isOneOf(parsed.rightMode, rightModes) ? { rightMode: parsed.rightMode } : {}),
    ...(typeof parsed.selectedLibraryComponent === "string"
      ? { selectedLibraryComponent: parsed.selectedLibraryComponent }
      : {}),
    ...(typeof parsed.selectedLibraryLayerId === "string"
      ? { selectedLibraryLayerId: parsed.selectedLibraryLayerId }
      : {}),
    ...(typeof parsed.selectedProjectFileId === "string"
      ? { selectedProjectFileId: parsed.selectedProjectFileId }
      : {}),
    ...(sourceWorkspaceSelection(parsed.selection)
      ? { selection: sourceWorkspaceSelection(parsed.selection) }
      : {}),
    ...(isOneOf(parsed.workspaceMode, workspaceModes) ? { workspaceMode: parsed.workspaceMode } : {}),
  };
}

export function saveSourceWorkspaceUiState(
  storage: Pick<Storage, "setItem"> | undefined,
  projectId: string,
  state: SourceWorkspaceUiState,
) {
  writeJson(storage, sourceWorkspaceUiStorageKey(projectId), {
    version: 1,
    ...state,
  } satisfies PersistedSourceWorkspaceUiState);
}

export function loadSourceTreeCollapsedBranches(
  storage: Pick<Storage, "getItem"> | undefined,
  namespace: string,
): ReadonlySet<string> | undefined {
  const parsed = readJson(storage, sourceTreeUiStorageKey(namespace));
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.collapsed)) return undefined;
  return new Set(parsed.collapsed.filter((value): value is string => typeof value === "string"));
}

export function saveSourceTreeCollapsedBranches(
  storage: Pick<Storage, "setItem"> | undefined,
  namespace: string,
  collapsed: ReadonlySet<string>,
) {
  writeJson(storage, sourceTreeUiStorageKey(namespace), {
    version: 1,
    collapsed: [...collapsed],
  } satisfies PersistedSourceTreeState);
}

export function sourceWorkspaceBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function sourceWorkspaceSelection(value: unknown): SourceWorkspaceSelection | undefined {
  if (!isRecord(value) || typeof value.nodeId !== "string" || !isOneOf(value.device, devices)) return undefined;
  const kind = isOneOf(value.kind, selectionKinds) ? value.kind : undefined;
  const occurrence = typeof value.renderedLayerOccurrence === "number"
    && Number.isInteger(value.renderedLayerOccurrence)
    && value.renderedLayerOccurrence >= 0
    ? value.renderedLayerOccurrence
    : undefined;
  return {
    device: value.device,
    nodeId: value.nodeId,
    ...(typeof value.layerId === "string" ? { layerId: value.layerId } : {}),
    ...(typeof value.occurrenceId === "string" ? { occurrenceId: value.occurrenceId } : {}),
    ...(occurrence !== undefined ? { renderedLayerOccurrence: occurrence } : {}),
    ...(typeof value.sourceNodeId === "string" ? { sourceNodeId: value.sourceNodeId } : {}),
    ...(typeof value.slotName === "string" ? { slotName: value.slotName } : {}),
    ...(kind ? { kind } : {}),
  };
}

function readJson(storage: Pick<Storage, "getItem"> | undefined, key: string): unknown {
  if (!storage) return undefined;
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(storage: Pick<Storage, "setItem"> | undefined, key: string, value: unknown) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // The editor remains usable when browser persistence is unavailable or full.
  }
}

function isOneOf<const Value extends string>(
  value: unknown,
  candidates: readonly Value[],
): value is Value {
  return typeof value === "string" && candidates.includes(value as Value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringRecord(value: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== "string")) return undefined;
  return Object.fromEntries(entries) as Readonly<Record<string, string>>;
}

function validPanelHeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 224 && value <= 2_000;
}
