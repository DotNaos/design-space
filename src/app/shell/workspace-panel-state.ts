export type WorkspacePanelNamespace = {
  projectId: string;
  documentId: string;
};

export type WorkspacePanelWidths = {
  left: number;
  right: number;
};

export type WorkspacePanelVisibility = {
  left: boolean;
  right: boolean;
  expanded: keyof WorkspacePanelWidths | null;
};

export type WorkspacePanelBounds = {
  left: PanelWidthBounds;
  right: PanelWidthBounds;
};

export type PanelWidthBounds = {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

type PersistedWorkspacePanelWidths = WorkspacePanelWidths & {
  version: 1;
};

const STORAGE_PREFIX = "design-space:workspace-panels:v1";
const VISIBILITY_STORAGE_PREFIX = "design-space:workspace-panel-visibility:v1";

export function workspacePanelStorageKey(namespace: WorkspacePanelNamespace) {
  return `${STORAGE_PREFIX}:${encodeURIComponent(namespace.projectId)}:${encodeURIComponent(namespace.documentId)}`;
}

export function workspacePanelVisibilityStorageKey(namespace: WorkspacePanelNamespace) {
  return `${VISIBILITY_STORAGE_PREFIX}:${encodeURIComponent(namespace.projectId)}:${encodeURIComponent(namespace.documentId)}`;
}

export function normalizePanelBounds(bounds: Partial<PanelWidthBounds> | undefined, fallback: PanelWidthBounds): PanelWidthBounds {
  const minWidth = Math.max(0, finiteOr(bounds?.minWidth, fallback.minWidth));
  const maxWidth = Math.max(minWidth, finiteOr(bounds?.maxWidth, fallback.maxWidth));
  return {
    minWidth,
    maxWidth,
    defaultWidth: clampPanelWidth(finiteOr(bounds?.defaultWidth, fallback.defaultWidth), { minWidth, maxWidth }),
  };
}

export function clampPanelWidth(width: number, bounds: Pick<PanelWidthBounds, "minWidth" | "maxWidth">) {
  if (!Number.isFinite(width)) return bounds.minWidth;
  return Math.min(bounds.maxWidth, Math.max(bounds.minWidth, width));
}

export function defaultPanelWidths(bounds: WorkspacePanelBounds): WorkspacePanelWidths {
  return { left: bounds.left.defaultWidth, right: bounds.right.defaultWidth };
}

export function clampPanelWidths(widths: WorkspacePanelWidths, bounds: WorkspacePanelBounds): WorkspacePanelWidths {
  return {
    left: clampPanelWidth(widths.left, bounds.left),
    right: clampPanelWidth(widths.right, bounds.right),
  };
}

export function fitWorkspacePanelWidths(
  widths: WorkspacePanelWidths,
  bounds: WorkspacePanelBounds,
  containerWidth: number,
  minimumCanvasWidth: number,
  separatorWidth = 2,
): WorkspacePanelWidths {
  const clamped = clampPanelWidths(widths, bounds);
  const minimumPanelWidth = bounds.left.minWidth + bounds.right.minWidth;
  const panelBudget = Math.max(
    minimumPanelWidth,
    Math.max(0, containerWidth - Math.max(0, minimumCanvasWidth) - separatorWidth),
  );
  if (clamped.left + clamped.right <= panelBudget) return clamped;

  const extraBudget = panelBudget - minimumPanelWidth;
  const leftExtra = clamped.left - bounds.left.minWidth;
  const rightExtra = clamped.right - bounds.right.minWidth;
  const totalExtra = leftExtra + rightExtra;
  if (totalExtra <= 0 || extraBudget <= 0) {
    return { left: bounds.left.minWidth, right: bounds.right.minWidth };
  }
  const fittedLeftExtra = Math.min(leftExtra, Math.round(extraBudget * (leftExtra / totalExtra)));
  const left = bounds.left.minWidth + fittedLeftExtra;
  const right = Math.min(clamped.right, panelBudget - left);
  return { left, right };
}

export function loadWorkspacePanelWidths(
  storage: Pick<Storage, "getItem"> | undefined,
  key: string,
  bounds: WorkspacePanelBounds,
): WorkspacePanelWidths {
  const fallback = defaultPanelWidths(bounds);
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspacePanelWidths> | null;
    if (!parsed || parsed.version !== 1) return fallback;
    return clampPanelWidths({
      left: finiteOr(parsed.left, fallback.left),
      right: finiteOr(parsed.right, fallback.right),
    }, bounds);
  } catch {
    return fallback;
  }
}

export function saveWorkspacePanelWidths(
  storage: Pick<Storage, "setItem"> | undefined,
  key: string,
  widths: WorkspacePanelWidths,
) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, ...widths } satisfies PersistedWorkspacePanelWidths));
  } catch {
    // Panel sizing remains usable when storage is unavailable or full.
  }
}

export function loadWorkspacePanelVisibility(
  storage: Pick<Storage, "getItem"> | undefined,
  key: string,
): WorkspacePanelVisibility {
  if (!storage) return { left: true, right: true, expanded: null };
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as Partial<WorkspacePanelVisibility> & { version?: number } | null;
    if (!parsed || parsed.version !== 1) return { left: true, right: true, expanded: null };
    return {
      left: typeof parsed.left === "boolean" ? parsed.left : true,
      right: typeof parsed.right === "boolean" ? parsed.right : true,
      expanded: parsed.expanded === "left" || parsed.expanded === "right" ? parsed.expanded : null,
    };
  } catch {
    return { left: true, right: true, expanded: null };
  }
}

export function saveWorkspacePanelVisibility(
  storage: Pick<Storage, "setItem"> | undefined,
  key: string,
  visibility: WorkspacePanelVisibility,
) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, ...visibility }));
  } catch {
    // Panel visibility remains usable when storage is unavailable or full.
  }
}

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
