import type { SourceDesignScope } from "../../shared/source-design";

export type SourceDraftScope = SourceDesignScope;

export type SourceDraftLocation = {
  scope: SourceDraftScope;
  rootId: string;
  fileId: string;
};

export type SourceDraftBase = SourceDraftLocation & {
  label: string;
  path: string;
  baseSource: string;
  baseVersion: string;
};

export type SourceDraftValidation = {
  state: "unvalidated" | "validating" | "valid" | "invalid";
  draftDigest: string;
  message?: string;
};

export type SourceDraftStaleState =
  | { state: "current" }
  | { state: "stale"; currentVersion?: string; message?: string };

export type SourceDraftApproval = {
  draftDigest: string;
  approvedAt: number;
};

export type SourceDraftAppliedSnapshot = {
  expectedBaseVersion: string;
  expectedDraftDigest: string;
  source: string;
  version: string;
};

export type SourceDraftVisualReview = {
  layerId: string;
  previewEntryId?: string;
  className?: string;
  css?: string;
  text?: string;
};

export type SourceDraftEntry = SourceDraftBase & {
  key: string;
  draftSource: string;
  draftDigest: string;
  history: readonly string[];
  future: readonly string[];
  validation: SourceDraftValidation;
  stale: SourceDraftStaleState;
  approval?: SourceDraftApproval;
  visualReview?: SourceDraftVisualReview;
  selectedForReview: boolean;
  updatedAt: number;
  dirty: boolean;
  approved: boolean;
};

export type SourceDraftGroup = {
  id: string;
  scope: SourceDraftScope;
  rootId: string;
  changes: readonly SourceDraftEntry[];
  changeCount: number;
  selectedChangeCount: number;
  approvedChangeCount: number;
  canApply: boolean;
};

export type SourceDraftWorkspaceSnapshot = {
  hydration: "idle" | "hydrating" | "ready" | "error";
  persistenceError?: string;
  entries: readonly SourceDraftEntry[];
  changes: readonly SourceDraftEntry[];
  groups: readonly SourceDraftGroup[];
  changeCount: number;
  selectedChangeCount: number;
  approvedChangeCount: number;
  canApply: boolean;
};

export type PersistedSourceDraftEntry = Omit<SourceDraftEntry, "approved" | "dirty">;

export type PersistedSourceDraftWorkspace = {
  version: 1;
  entries: readonly PersistedSourceDraftEntry[];
};

export type SourceDraftPersistenceMutation = {
  origin: string;
  removals: readonly string[];
  upserts: readonly PersistedSourceDraftEntry[];
};

export interface SourceDraftPersistenceAdapter {
  load(): Promise<PersistedSourceDraftWorkspace | undefined>;
  mutate(mutation: SourceDraftPersistenceMutation): Promise<void>;
  subscribe?(listener: (mutation: SourceDraftPersistenceMutation) => void): () => void;
}

export type SourceDraftPrepareRequest = SourceDraftLocation & {
  baseVersion: string;
  draftSource: string;
  draftDigest: string;
};

export type SourceDraftPrepareResult<TPrepared = unknown> =
  | { state: "valid"; prepared: TPrepared }
  | { state: "invalid"; message: string }
  | { state: "stale"; message?: string; currentVersion?: string };

export interface SourceDraftSourceAdapter<TPrepared = unknown> {
  read(location: SourceDraftLocation): Promise<SourceDraftBase>;
  prepare(request: SourceDraftPrepareRequest): Promise<SourceDraftPrepareResult<TPrepared>>;
  prepareGroup?(requests: readonly SourceDraftPrepareRequest[]): Promise<SourceDraftPrepareResult<TPrepared>>;
}

export interface SourceDraftWorkspaceStore<TPrepared = unknown> {
  getSnapshot(): SourceDraftWorkspaceSnapshot;
  subscribe(listener: () => void): () => void;
  hydrate(): Promise<void>;
  flush(): Promise<void>;
  open(base: SourceDraftBase): SourceDraftEntry;
  readFromSource(location: SourceDraftLocation): Promise<SourceDraftEntry>;
  get(location: SourceDraftLocation): SourceDraftEntry | undefined;
  edit(location: SourceDraftLocation, source: string): void;
  undo(location: SourceDraftLocation): void;
  redo(location: SourceDraftLocation): void;
  reset(location: SourceDraftLocation): void;
  remove(location: SourceDraftLocation): void;
  setValidation(location: SourceDraftLocation, validation: "unvalidated" | "validating" | "valid" | "invalid", message?: string): void;
  markStale(location: SourceDraftLocation, currentVersion?: string, message?: string): void;
  clearStale(location: SourceDraftLocation): void;
  setSelectedForReview(location: SourceDraftLocation, selected: boolean): void;
  approve(location: SourceDraftLocation, approved?: boolean): void;
  setVisualReview(location: SourceDraftLocation, review?: SourceDraftVisualReview): void;
  prepare(location: SourceDraftLocation): Promise<SourceDraftPrepareResult<TPrepared> | undefined>;
  prepareGroup(locations: readonly SourceDraftLocation[]): Promise<SourceDraftPrepareResult<TPrepared> | undefined>;
  acceptApplied(location: SourceDraftLocation, applied: SourceDraftAppliedSnapshot): void;
}

export type SourceDraftWorkspaceOptions<TPrepared = unknown> = {
  persistence?: SourceDraftPersistenceAdapter;
  sourceAdapter?: SourceDraftSourceAdapter<TPrepared>;
  historyLimit?: number;
  now?: () => number;
};
