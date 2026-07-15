import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { validateStrictUi } from "../../model/strict-ui";
import type {
  DocumentCatalog,
  DocumentCatalogEntry,
  DocumentCreationRecipeEntry,
  DocumentCatalogFileEntry,
  DocumentSnapshot,
  PreparedDocumentCreate,
  PreparedDocumentSave,
  SavedDocument,
} from "../../shared/document-transactions";
import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { LocalOperationError, runLocalOperation } from "../api";
import {
  clearDocumentDraft,
  loadDocumentDraft,
  saveDocumentDraft,
} from "./document-draft-storage";
import {
  createDocumentSession,
  documentSessionReducer,
  isDocumentDirty,
  type DocumentSessionAction,
  type DocumentSessionState,
} from "./document-session";
import { createRefreshScheduler } from "./refresh-scheduler";

export interface DocumentWorkspaceController {
  activeDocumentId?: string;
  session?: DocumentSessionState;
  entries: readonly DocumentCatalogEntry[];
  creationRecipes: readonly DocumentCreationRecipeEntry[];
  files: readonly DocumentCatalogFileEntry[];
  documents: readonly DesignDocument[];
  connected: boolean;
  loading: boolean;
  message?: string;
  liveViolations: ReturnType<typeof validateStrictUi>;
  selectDocument: (documentId: string) => void;
  edit: (document: DesignDocument) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  refresh: () => Promise<void>;
  prepareCreate: (recipeId: string, label: string) => Promise<PreparedDocumentCreate | undefined>;
  saveCreate: (challengeId: string, documentId: string) => Promise<SavedDocument | undefined>;
  prepare: () => Promise<PreparedDocumentSave | undefined>;
  save: () => Promise<SavedDocument | undefined>;
}

export function useDocumentWorkspace(target: TargetModule): DocumentWorkspaceController {
  const initialEntries: readonly DocumentCatalogEntry[] = (target.documents ?? []).map((entry) => ({ ...entry, origin: "registered" }));
  const [catalog, setCatalog] = useState<DocumentCatalog>({ state: "catalog", documents: initialEntries, recipes: [], files: [] });
  const [activeDocumentId, setActiveDocumentId] = useState(target.defaultDocumentId ?? initialEntries[0]?.id);
  const [sessions, setSessions] = useState<Readonly<Record<string, DocumentSessionState>>>({});
  const sessionsRef = useRef<Readonly<Record<string, DocumentSessionState>>>({});
  const workspaceGeneration = useRef(0);
  const checkSequence = useRef(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();
  const active = activeDocumentId ? sessions[activeDocumentId] : undefined;

  const apply = useCallback((documentId: string, action: DocumentSessionAction) => {
    const current = sessionsRef.current;
    const session = current[documentId];
    if (!session) return;
    const next = documentSessionReducer(session, action);
    if (next === session) return;
    if (isDocumentDirty(next)) {
      saveDocumentDraft(window.localStorage, target.project.id, {
        baseDocumentDigest: next.baseDocumentDigest,
        sourceVersions: next.sourceVersions,
        document: next.draft,
        savedAt: new Date().toISOString(),
      });
    } else {
      clearDocumentDraft(window.localStorage, target.project.id, documentId);
    }
    const updated = { ...current, [documentId]: next };
    sessionsRef.current = updated;
    setSessions(updated);
  }, [target.project.id]);

  const loadSnapshot = useCallback((snapshot: DocumentSnapshot, current?: DocumentSessionState): DocumentSessionState => {
    if (current) {
      return documentSessionReducer(current, {
        type: "source-changed",
        document: snapshot.document,
        documentDigest: snapshot.documentDigest,
        sourceVersions: snapshot.sourceVersions,
      });
    }
    const initial = createDocumentSession(snapshot.document, snapshot.documentDigest, snapshot.sourceVersions);
    const stored = loadDocumentDraft(window.localStorage, target.project.id, snapshot.documentId);
    if (!stored) return initial;
    const restored = documentSessionReducer(initial, { type: "edit", document: stored.document });
    const sourcesStillMatch = stored.baseDocumentDigest === snapshot.documentDigest && sameVersions(stored.sourceVersions, snapshot.sourceVersions);
    return sourcesStillMatch ? restored : {
      ...restored,
      phase: "stale",
      staleSnapshot: {
        document: snapshot.document,
        documentDigest: snapshot.documentDigest,
        sourceVersions: snapshot.sourceVersions,
      },
    };
  }, [target.project.id]);

  const runRefresh = useCallback(async () => {
    const generation = workspaceGeneration.current;
    try {
      const nextCatalog = await runLocalOperation<DocumentCatalog>({ type: "list-documents" });
      if (generation !== workspaceGeneration.current) return;
      const snapshots = await Promise.all(nextCatalog.documents.map((entry) => runLocalOperation<DocumentSnapshot>({
        type: "read-document",
        documentId: entry.id,
      })));
      if (generation !== workspaceGeneration.current) return;
      setCatalog(nextCatalog);
      const nextSessions = Object.fromEntries(snapshots.map((snapshot) => [
        snapshot.documentId,
        loadSnapshot(snapshot, sessionsRef.current[snapshot.documentId]),
      ]));
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      setActiveDocumentId((current) => nextCatalog.documents.some((entry) => entry.id === current)
        ? current
        : nextCatalog.documents.find((entry) => entry.id === target.defaultDocumentId)?.id ?? nextCatalog.documents[0]?.id);
      setConnected(true);
      setMessage(nextCatalog.documents.length ? undefined : "No documents yet · create one from a registered recipe.");
    } catch (error) {
      if (generation !== workspaceGeneration.current) return;
      setConnected(false);
      setMessage(errorMessage(error));
    } finally {
      if (generation === workspaceGeneration.current) setLoading(false);
    }
  }, [loadSnapshot, target.defaultDocumentId]);

  const runRefreshRef = useRef(runRefresh);
  runRefreshRef.current = runRefresh;
  const refreshScheduler = useMemo(
    () => createRefreshScheduler(() => runRefreshRef.current()),
    [target.project.id],
  );
  const refresh = useCallback(() => refreshScheduler.request(), [refreshScheduler]);

  useEffect(() => {
    refreshScheduler.activate();
    void refresh();
    const onFocus = () => void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    window.addEventListener("focus", onFocus);
    return () => {
      workspaceGeneration.current += 1;
      refreshScheduler.dispose();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, refreshScheduler]);

  const prepare = useCallback(async () => {
    if (!activeDocumentId || !active || !connected || active.phase === "stale" || !isDocumentDirty(active)) return undefined;
    const checkId = `check-${++checkSequence.current}`;
    apply(activeDocumentId, { type: "check-started", checkId });
    try {
      const result = await runLocalOperation<PreparedDocumentSave>({
        type: "prepare-document-save",
        documentId: activeDocumentId,
        baseDocumentDigest: active.baseDocumentDigest,
        baseSourceVersions: active.sourceVersions,
        document: active.draft,
      });
      if (sessionsRef.current[activeDocumentId]?.pendingCheckId !== checkId) return undefined;
      if (result.state === "strict-blocked") {
        apply(activeDocumentId, { type: "strict-blocked", checkId, evidence: result.strictUi });
      } else if (result.state === "compile-blocked") {
        apply(activeDocumentId, {
          type: "compile-failed",
          checkId,
          evidence: result.strictUi,
          message: result.compile.message ?? "The target did not compile.",
        });
      } else {
        apply(activeDocumentId, {
          type: "prepare-succeeded",
          checkId,
          evidence: result.strictUi,
          prepared: {
            challengeId: result.challengeId,
            documentDigest: result.documentDigest,
            exactDiff: result.diff,
            expiresAt: result.expiresAt,
          },
        });
      }
      setMessage(undefined);
      return result;
    } catch (error) {
      apply(activeDocumentId, { type: "check-failed", checkId });
      setMessage(errorMessage(error));
      if (error instanceof LocalOperationError && error.code === "STALE_SOURCE") await refresh();
      return undefined;
    }
  }, [active, activeDocumentId, apply, connected, refresh]);

  const prepareCreate = useCallback(async (recipeId: string, label: string) => {
    if (!connected) return undefined;
    try {
      const result = await runLocalOperation<PreparedDocumentCreate>({
        type: "prepare-document-create",
        recipeId,
        label,
      });
      setMessage(undefined);
      return result;
    } catch (error) {
      setMessage(errorMessage(error));
      return undefined;
    }
  }, [connected]);

  const saveCreate = useCallback(async (challengeId: string, documentId: string) => {
    try {
      const result = await runLocalOperation<SavedDocument>({ type: "save-document", challengeId });
      await refresh();
      setActiveDocumentId(documentId);
      setMessage(undefined);
      return result;
    } catch (error) {
      setMessage(errorMessage(error));
      return undefined;
    }
  }, [refresh]);

  const save = useCallback(async () => {
    if (!activeDocumentId || !active?.prepared || active.phase !== "diff-ready") return undefined;
    const challengeId = active.prepared.challengeId;
    apply(activeDocumentId, { type: "save-started", challengeId });
    try {
      const result = await runLocalOperation<SavedDocument>({ type: "save-document", challengeId });
      const current = sessionsRef.current[activeDocumentId];
      if (current?.phase !== "saving" || current.prepared?.challengeId !== challengeId) {
        await refresh();
        return undefined;
      }
      apply(activeDocumentId, {
        type: "save-succeeded",
        challengeId,
        documentDigest: result.documentDigest,
        sourceVersions: result.sourceVersions,
      });
      setMessage(undefined);
      window.setTimeout(() => apply(activeDocumentId, { type: "clear-saved" }), 900);
      return result;
    } catch (error) {
      apply(activeDocumentId, { type: "save-failed", challengeId });
      setMessage(errorMessage(error));
      if (error instanceof LocalOperationError && error.code === "STALE_SOURCE") await refresh();
      return undefined;
    }
  }, [active, activeDocumentId, apply, refresh]);

  const documents = useMemo(() => catalog.documents.flatMap((entry) => sessions[entry.id]?.draft ? [sessions[entry.id].draft] : []), [catalog.documents, sessions]);
  const liveViolations = useMemo(() => active ? validateStrictUi(target, active.draft, documents) : [], [active, documents, target]);

  return {
    activeDocumentId,
    session: active,
    entries: catalog.documents,
    creationRecipes: catalog.recipes,
    files: catalog.files,
    documents,
    connected,
    loading,
    message,
    liveViolations,
    selectDocument: (documentId) => {
      if (catalog.documents.some((entry) => entry.id === documentId)) setActiveDocumentId(documentId);
    },
    edit: (document) => activeDocumentId && apply(activeDocumentId, { type: "edit", document }),
    undo: () => activeDocumentId && apply(activeDocumentId, { type: "undo" }),
    redo: () => activeDocumentId && apply(activeDocumentId, { type: "redo" }),
    reset: () => activeDocumentId && apply(activeDocumentId, { type: "reset" }),
    refresh,
    prepareCreate,
    saveCreate,
    prepare,
    save,
  };
}

function sameVersions(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  const entries = Object.entries(left);
  return entries.length === Object.keys(right).length && entries.every(([key, value]) => right[key] === value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The local document operation failed.";
}
