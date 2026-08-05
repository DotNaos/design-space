import { useCallback, useEffect, useRef, useState } from "react";

import type {
  PreparedProjectFileEdit,
  ProjectFileSnapshot,
  SavedProjectFileEdit,
} from "../../shared/contracts";
import { LocalOperationError, runLocalOperation } from "../api";

export function useSourceFileEditor(
  fileId: string | undefined,
  scope: "app" | "library-development" = "app",
) {
  const request = useRef(0);
  const [snapshot, setSnapshot] = useState<ProjectFileSnapshot>();
  const [draft, setDraftState] = useState("");
  const [prepared, setPrepared] = useState<PreparedProjectFileEdit>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const history = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    if (!fileId) {
      setSnapshot(undefined);
      setDraftState("");
      history.current = [];
      future.current = [];
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const next = await runLocalOperation<ProjectFileSnapshot>({
        type: "read-project-file",
        fileId,
        ...(scope === "library-development" ? { scope } : {}),
      });
      if (request.current !== current) return;
      setSnapshot(next);
      setDraftState(next.source);
      history.current = [];
      future.current = [];
      setHistoryVersion((value) => value + 1);
      setPrepared(undefined);
    } catch (reason) {
      if (request.current === current) setError(messageFor(reason));
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [fileId, scope]);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  const setDraft = (source: string) => {
    if (source === draft) return;
    history.current = [...history.current.slice(-99), draft];
    future.current = [];
    setDraftState(source);
    setHistoryVersion((value) => value + 1);
    setPrepared(undefined);
    setError(undefined);
  };
  const reset = () => {
    setDraftState(snapshot?.source ?? "");
    history.current = [];
    future.current = [];
    setHistoryVersion((value) => value + 1);
    setPrepared(undefined);
    setError(undefined);
  };
  const prepare = useCallback(async () => {
    if (!snapshot || draft === snapshot.source) return undefined;
    setError(undefined);
    try {
      const next = await runLocalOperation<PreparedProjectFileEdit>({
        type: "prepare-project-file-edit",
        fileId: snapshot.fileId,
        baseVersion: snapshot.version,
        source: draft,
        ...(scope === "library-development" ? { scope } : {}),
      });
      setPrepared(next);
      return next;
    } catch (reason) {
      if (reason instanceof LocalOperationError && reason.code === "STALE_SOURCE") void load();
      setError(messageFor(reason));
      return undefined;
    }
  }, [draft, load, scope, snapshot]);
  const save = useCallback(async () => {
    if (!prepared) return undefined;
    setSaving(true);
    setError(undefined);
    try {
      const result = await runLocalOperation<SavedProjectFileEdit>({
        type: "save-project-file-edit",
        challengeId: prepared.challengeId,
      });
      setSnapshot(result);
      setDraftState(result.source);
      history.current = [];
      future.current = [];
      setHistoryVersion((value) => value + 1);
      setPrepared(undefined);
      return result;
    } catch (reason) {
      if (reason instanceof LocalOperationError && reason.code === "STALE_SOURCE") void load();
      setError(messageFor(reason));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [load, prepared]);

  return {
    draft,
    dirty: Boolean(snapshot && draft !== snapshot.source),
    error,
    loading,
    prepared,
    saving,
    snapshot,
    setDraft,
    canUndo: historyVersion >= 0 && history.current.length > 0,
    canRedo: historyVersion >= 0 && future.current.length > 0,
    undo: () => {
      const previous = history.current.at(-1);
      if (previous === undefined) return;
      history.current = history.current.slice(0, -1);
      future.current = [draft, ...future.current.slice(0, 99)];
      setDraftState(previous);
      setPrepared(undefined);
      setError(undefined);
      setHistoryVersion((value) => value + 1);
    },
    redo: () => {
      const next = future.current[0];
      if (next === undefined) return;
      future.current = future.current.slice(1);
      history.current = [...history.current.slice(-99), draft];
      setDraftState(next);
      setPrepared(undefined);
      setError(undefined);
      setHistoryVersion((value) => value + 1);
    },
    reset,
    prepare,
    save,
    clearPrepared: () => setPrepared(undefined),
  };
}

function messageFor(reason: unknown): string {
  return reason instanceof Error ? reason.message : "The source editor could not complete this operation.";
}

export type SourceFileEditor = ReturnType<typeof useSourceFileEditor>;
