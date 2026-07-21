import type {
  PersistedSourceDraftEntry,
  SourceDraftBase,
  SourceDraftEntry,
  SourceDraftGroup,
  SourceDraftLocation,
  SourceDraftPersistenceMutation,
  SourceDraftPrepareRequest,
  SourceDraftPrepareResult,
  SourceDraftSourceAdapter,
  SourceDraftValidation,
  SourceDraftWorkspaceOptions,
  SourceDraftWorkspaceSnapshot,
  SourceDraftWorkspaceStore,
} from "./source-draft-workspace-types";

export * from "./source-draft-workspace-types";

const DEFAULT_HISTORY_LIMIT = 100;
let persistenceOriginSequence = 0;

export function sourceDraftKey(location: SourceDraftLocation): string {
  return JSON.stringify([location.scope, location.rootId, location.fileId]);
}

export function sourceDraftGroupId(location: Pick<SourceDraftLocation, "scope" | "rootId">): string {
  return JSON.stringify([location.scope, location.rootId]);
}

export function sourceDraftDigest(source: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= BigInt(source.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${source.length}:${hash.toString(16).padStart(16, "0")}`;
}

export function createSourceDraftWorkspace<TPrepared = unknown>(
  options: SourceDraftWorkspaceOptions<TPrepared> = {},
): SourceDraftWorkspaceStore<TPrepared> {
  const entries = new Map<string, SourceDraftEntry>();
  const listeners = new Set<() => void>();
  const now = options.now ?? Date.now;
  const historyLimit = Math.max(1, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
  const persistenceOrigin = `source-draft-workspace-${++persistenceOriginSequence}`;
  let hydration: SourceDraftWorkspaceSnapshot["hydration"] = "idle";
  let persistenceError: string | undefined;
  let snapshot = buildSnapshot(entries, hydration, persistenceError);
  let hydrationPromise: Promise<void> | undefined;
  let persistenceQueue = Promise.resolve();
  const pendingPersistence = new Map<string, PersistedSourceDraftEntry | null>();

  const notify = () => {
    snapshot = buildSnapshot(entries, hydration, persistenceError);
    listeners.forEach((listener) => listener());
  };

  const persistMutation = (delta: Omit<SourceDraftPersistenceMutation, "origin">) => {
    if (!options.persistence) return;
    if (hydration !== "ready" && hydration !== "error") {
      delta.removals.forEach((key) => pendingPersistence.set(key, null));
      delta.upserts.forEach((entry) => pendingPersistence.set(entry.key, entry));
      return;
    }
    const mutation: SourceDraftPersistenceMutation = { ...delta, origin: persistenceOrigin };
    persistenceQueue = persistenceQueue.then(async () => {
      try {
        await options.persistence!.mutate(mutation);
        if (persistenceError) {
          persistenceError = undefined;
          notify();
        }
      } catch (reason) {
        persistenceError = messageFor(reason, "The source draft cache could not be updated.");
        notify();
      }
    });
  };

  const schedulePersistence = (entry: SourceDraftEntry | undefined, key: string) => {
    persistMutation(entry?.dirty
      ? { removals: [], upserts: [toPersistedEntry(entry)] }
      : { removals: [key], upserts: [] });
  };

  const replace = (entry: SourceDraftEntry, persist = true) => {
    entries.set(entry.key, entry);
    notify();
    if (persist) schedulePersistence(entry, entry.key);
  };

  const mutateDraft = (
    entry: SourceDraftEntry,
    draftSource: string,
    history: readonly string[],
    future: readonly string[],
  ) => {
    const draftDigest = sourceDraftDigest(draftSource);
    const next = deriveEntry({
      ...entry,
      draftSource,
      draftDigest,
      history,
      future,
      validation: unvalidated(draftDigest),
      approval: undefined,
      updatedAt: now(),
    });
    const changed = [next];
    entries.set(next.key, next);
    for (const candidate of entries.values()) {
      if (candidate.key === next.key || !candidate.dirty || sourceDraftGroupId(candidate) !== sourceDraftGroupId(next)) continue;
      const invalidated = deriveEntry({
        ...candidate,
        validation: unvalidated(candidate.draftDigest),
        approval: undefined,
      });
      entries.set(candidate.key, invalidated);
      changed.push(invalidated);
    }
    notify();
    changed.forEach((entry) => schedulePersistence(entry, entry.key));
  };

  const store: SourceDraftWorkspaceStore<TPrepared> = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async hydrate() {
      if (hydrationPromise) return hydrationPromise;
      hydration = "hydrating";
      notify();
      hydrationPromise = (async () => {
        try {
          const persisted = await options.persistence?.load();
          if (persisted?.version === 1) {
            for (const candidate of persisted.entries) {
              const restored = restorePersistedEntry(candidate, historyLimit);
              if (!restored?.dirty) continue;
              if (pendingPersistence.get(restored.key) === null) continue;
              const current = entries.get(restored.key);
              if (!current) {
                entries.set(restored.key, restored);
              } else if (!current.dirty) {
                entries.set(restored.key, current.baseVersion === restored.baseVersion && current.baseSource === restored.baseSource
                  ? deriveEntry({ ...restored, label: current.label, path: current.path, rootId: current.rootId })
                  : deriveEntry({
                    ...restored,
                    label: current.label,
                    path: current.path,
                    rootId: current.rootId,
                    stale: { state: "stale", currentVersion: current.baseVersion },
                  }));
              }
            }
          }
          hydration = "ready";
          persistenceError = undefined;
        } catch (reason) {
          hydration = "error";
          persistenceError = messageFor(reason, "The source draft cache could not be restored.");
        }
        notify();
        if (pendingPersistence.size) {
          const removals: string[] = [];
          const upserts: PersistedSourceDraftEntry[] = [];
          for (const [key, entry] of pendingPersistence) {
            if (entry) upserts.push(entry);
            else removals.push(key);
          }
          pendingPersistence.clear();
          persistMutation({ removals, upserts });
        }
      })();
      return hydrationPromise;
    },
    async flush() {
      await store.hydrate();
      await persistenceQueue;
    },
    open(base) {
      const key = sourceDraftKey(base);
      const current = entries.get(key);
      let next: SourceDraftEntry;
      if (current?.dirty) {
        const baseMatches = current.baseVersion === base.baseVersion && current.baseSource === base.baseSource;
        next = deriveEntry({
          ...current,
          label: base.label,
          path: base.path,
          stale: baseMatches ? current.stale : { state: "stale", currentVersion: base.baseVersion },
        });
      } else {
        const digest = sourceDraftDigest(base.baseSource);
        next = deriveEntry({
          ...base,
          key,
          draftSource: base.baseSource,
          draftDigest: digest,
          history: [],
          future: [],
          validation: unvalidated(digest),
          stale: { state: "current" },
          selectedForReview: true,
          updatedAt: now(),
        });
      }
      replace(next, Boolean(current?.dirty));
      return next;
    },
    async readFromSource(location) {
      if (!options.sourceAdapter) throw new Error("No source draft adapter is configured.");
      return store.open(await options.sourceAdapter.read(location));
    },
    get(location) {
      return entries.get(sourceDraftKey(location));
    },
    edit(location, source) {
      const current = requiredEntry(entries, location);
      if (source === current.draftSource) return;
      mutateDraft(current, source, [...current.history.slice(-(historyLimit - 1)), current.draftSource], []);
    },
    undo(location) {
      const current = requiredEntry(entries, location);
      const previous = current.history.at(-1);
      if (previous === undefined) return;
      mutateDraft(current, previous, current.history.slice(0, -1), [current.draftSource, ...current.future].slice(0, historyLimit));
    },
    redo(location) {
      const current = requiredEntry(entries, location);
      const next = current.future[0];
      if (next === undefined) return;
      mutateDraft(current, next, [...current.history.slice(-(historyLimit - 1)), current.draftSource], current.future.slice(1));
    },
    reset(location) {
      const current = requiredEntry(entries, location);
      if (!current.dirty && current.history.length === 0 && current.future.length === 0) return;
      mutateDraft(current, current.baseSource, [], []);
    },
    remove(location) {
      const key = sourceDraftKey(location);
      if (!entries.delete(key)) return;
      notify();
      schedulePersistence(undefined, key);
    },
    setValidation(location, state, message) {
      const current = requiredEntry(entries, location);
      const validation: SourceDraftValidation = {
        state,
        draftDigest: current.draftDigest,
        ...(message ? { message } : {}),
      };
      replace(deriveEntry({ ...current, validation }), state !== "validating");
    },
    markStale(location, currentVersion, message) {
      const current = requiredEntry(entries, location);
      replace(deriveEntry({
        ...current,
        stale: { state: "stale", ...(currentVersion ? { currentVersion } : {}), ...(message ? { message } : {}) },
      }));
    },
    clearStale(location) {
      const current = requiredEntry(entries, location);
      if (current.stale.state === "current") return;
      replace(deriveEntry({ ...current, stale: { state: "current" } }));
    },
    setSelectedForReview(location, selectedForReview) {
      const current = requiredEntry(entries, location);
      if (current.selectedForReview === selectedForReview) return;
      replace(deriveEntry({ ...current, selectedForReview }));
    },
    approve(location, approved = true) {
      const current = requiredEntry(entries, location);
      const approval = approved && current.dirty
        ? { draftDigest: current.draftDigest, approvedAt: now() }
        : undefined;
      replace(deriveEntry({ ...current, approval }));
    },
    setVisualReview(location, visualReview) {
      const current = requiredEntry(entries, location);
      if (sameVisualReview(current.visualReview, visualReview)) return;
      replace(deriveEntry({
        ...current,
        ...(visualReview ? { visualReview } : { visualReview: undefined }),
        updatedAt: now(),
      }));
    },
    async prepare(location) {
      if (!options.sourceAdapter) return undefined;
      const current = requiredEntry(entries, location);
      if (!current.dirty) return undefined;
      store.setValidation(location, "validating");
      const requestDigest = current.draftDigest;
      const result = await options.sourceAdapter.prepare({
        scope: current.scope,
        rootId: current.rootId,
        fileId: current.fileId,
        baseVersion: current.baseVersion,
        draftSource: current.draftSource,
        draftDigest: requestDigest,
      });
      const latest = store.get(location);
      if (!latest || latest.draftDigest !== requestDigest) return result;
      applyPrepareResult(store, location, result);
      return result;
    },
    async prepareGroup(locations) {
      if (!options.sourceAdapter || !locations.length) return undefined;
      const current = locations.map((location) => requiredEntry(entries, location)).filter((entry) => entry.dirty);
      if (!current.length) return undefined;
      const groupId = sourceDraftGroupId(current[0]!);
      if (current.some((entry) => sourceDraftGroupId(entry) !== groupId)) {
        throw new Error("A source draft validation group must belong to one repository root.");
      }
      current.forEach((entry) => store.setValidation(entry, "validating"));
      const requests = current.map((entry) => ({
        scope: entry.scope,
        rootId: entry.rootId,
        fileId: entry.fileId,
        baseVersion: entry.baseVersion,
        draftSource: entry.draftSource,
        draftDigest: entry.draftDigest,
      }));
      const result = options.sourceAdapter.prepareGroup
        ? await options.sourceAdapter.prepareGroup(requests)
        : await prepareSequentially(options.sourceAdapter, requests);
      const latest = current.map((entry) => store.get(entry));
      if (latest.some((entry, index) => !entry || entry.draftDigest !== requests[index]!.draftDigest)) {
        latest.forEach((entry, index) => {
          if (entry?.draftDigest === requests[index]!.draftDigest) store.setValidation(entry, "unvalidated");
        });
        return result;
      }
      current.forEach((entry) => applyPrepareResult(store, entry, result));
      return result;
    },
    acceptApplied(location, applied) {
      const current = entries.get(sourceDraftKey(location));
      if (!current || current.baseVersion !== applied.expectedBaseVersion) return;
      const appliedDigest = sourceDraftDigest(applied.source);
      if (appliedDigest !== applied.expectedDraftDigest) {
        throw new Error("The applied source does not match the reviewed draft digest.");
      }
      if (current.draftDigest !== applied.expectedDraftDigest) {
        replace(deriveEntry({
          ...current,
          baseSource: applied.source,
          baseVersion: applied.version,
          history: current.draftSource === applied.source ? [] : [applied.source],
          future: [],
          validation: unvalidated(current.draftDigest),
          stale: { state: "current" },
          approval: undefined,
          updatedAt: now(),
        }));
        return;
      }
      replace(deriveEntry({
        ...current,
        baseSource: applied.source,
        baseVersion: applied.version,
        draftSource: applied.source,
        draftDigest: appliedDigest,
        history: [],
        future: [],
        validation: unvalidated(appliedDigest),
        stale: { state: "current" },
        approval: undefined,
        selectedForReview: false,
        updatedAt: now(),
      }));
    },
  };

  options.persistence?.subscribe?.((mutation) => {
    if (mutation.origin === persistenceOrigin) return;
    let changed = false;
    for (const key of mutation.removals) changed = entries.delete(key) || changed;
    for (const candidate of mutation.upserts) {
      const restored = restorePersistedEntry(candidate, historyLimit);
      if (!restored?.dirty) continue;
      entries.set(restored.key, restored);
      changed = true;
    }
    if (changed) notify();
  });

  return store;
}

async function prepareSequentially<TPrepared>(
  adapter: SourceDraftSourceAdapter<TPrepared>,
  requests: readonly SourceDraftPrepareRequest[],
): Promise<SourceDraftPrepareResult<TPrepared>> {
  let last: SourceDraftPrepareResult<TPrepared> | undefined;
  for (const request of requests) {
    last = await adapter.prepare(request);
    if (last.state !== "valid") return last;
  }
  if (!last) throw new Error("A source draft validation group cannot be empty.");
  return last;
}

function applyPrepareResult<TPrepared>(
  store: SourceDraftWorkspaceStore<TPrepared>,
  location: SourceDraftLocation,
  result: SourceDraftPrepareResult<TPrepared>,
) {
  if (result.state === "valid") store.setValidation(location, "valid");
  if (result.state === "invalid") store.setValidation(location, "invalid", result.message);
  if (result.state === "stale") {
    store.setValidation(location, "invalid", result.message ?? "The source changed after this draft was opened.");
    store.markStale(location, result.currentVersion, result.message);
  }
}

function requiredEntry(entries: Map<string, SourceDraftEntry>, location: SourceDraftLocation): SourceDraftEntry {
  const entry = entries.get(sourceDraftKey(location));
  if (!entry) throw new Error(`Source draft is not open: ${location.fileId}`);
  return entry;
}

function unvalidated(draftDigest: string): SourceDraftValidation {
  return { state: "unvalidated", draftDigest };
}

function deriveEntry(entry: Omit<SourceDraftEntry, "approved" | "dirty"> | SourceDraftEntry): SourceDraftEntry {
  const dirty = entry.draftSource !== entry.baseSource;
  const approval = dirty && entry.approval?.draftDigest === entry.draftDigest ? entry.approval : undefined;
  return { ...entry, ...(approval ? { approval } : { approval: undefined }), dirty, approved: Boolean(approval) };
}

function toPersistedEntry(entry: SourceDraftEntry): PersistedSourceDraftEntry {
  const { approved: _approved, dirty: _dirty, ...persisted } = entry;
  return persisted;
}

function restorePersistedEntry(candidate: PersistedSourceDraftEntry, historyLimit: number): SourceDraftEntry | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  if (candidate.key !== sourceDraftKey(candidate) || typeof candidate.draftSource !== "string") return undefined;
  const draftDigest = sourceDraftDigest(candidate.draftSource);
  const persistedValidation = candidate.validation?.draftDigest === draftDigest
    ? candidate.validation
    : unvalidated(draftDigest);
  const validation = persistedValidation.state === "validating"
    ? unvalidated(draftDigest)
    : persistedValidation;
  return deriveEntry({
    ...candidate,
    draftDigest,
    history: Array.isArray(candidate.history) ? candidate.history.filter((item) => typeof item === "string").slice(-historyLimit) : [],
    future: Array.isArray(candidate.future) ? candidate.future.filter((item) => typeof item === "string").slice(0, historyLimit) : [],
    validation,
    approval: candidate.approval?.draftDigest === draftDigest ? candidate.approval : undefined,
  });
}

function buildSnapshot(
  entries: Map<string, SourceDraftEntry>,
  hydration: SourceDraftWorkspaceSnapshot["hydration"],
  persistenceError?: string,
): SourceDraftWorkspaceSnapshot {
  const all = [...entries.values()];
  const changes = all.filter((entry) => entry.dirty).sort((left, right) => left.updatedAt - right.updatedAt);
  const grouped = new Map<string, SourceDraftEntry[]>();
  changes.forEach((entry) => {
    const id = sourceDraftGroupId(entry);
    grouped.set(id, [...(grouped.get(id) ?? []), entry]);
  });
  const groups = [...grouped.entries()].map(([id, groupChanges]): SourceDraftGroup => {
    const selected = groupChanges.filter((entry) => entry.selectedForReview);
    return {
      id,
      scope: groupChanges[0]!.scope,
      rootId: groupChanges[0]!.rootId,
      changes: groupChanges,
      changeCount: groupChanges.length,
      selectedChangeCount: selected.length,
      approvedChangeCount: groupChanges.filter((entry) => entry.approved).length,
      canApply: selected.length > 0 && selected.every(canApplyEntry),
    };
  });
  const selected = changes.filter((entry) => entry.selectedForReview);
  return {
    hydration,
    ...(persistenceError ? { persistenceError } : {}),
    entries: all,
    changes,
    groups,
    changeCount: changes.length,
    selectedChangeCount: selected.length,
    approvedChangeCount: changes.filter((entry) => entry.approved).length,
    canApply: selected.length > 0 && selected.every(canApplyEntry),
  };
}

function canApplyEntry(entry: SourceDraftEntry): boolean {
  return entry.approved
    && entry.stale.state === "current"
    && entry.validation.state === "valid"
    && entry.validation.draftDigest === entry.draftDigest;
}

function messageFor(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function sameVisualReview(
  left: SourceDraftEntry["visualReview"],
  right: SourceDraftEntry["visualReview"],
): boolean {
  return left?.layerId === right?.layerId
    && left?.previewEntryId === right?.previewEntryId
    && left?.className === right?.className
    && left?.css === right?.css
    && left?.text === right?.text;
}
