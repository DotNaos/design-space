import { useCallback, useEffect, useRef, useState } from "react";

import type {
  PreparedProjectFileEdit,
  ProjectFileSnapshot,
  SavedProjectFileEdit,
} from "../../shared/contracts";
import { LocalOperationError, runLocalOperation } from "../api";

export function useSourceFileEditor(fileId: string | undefined) {
  const request = useRef(0);
  const [snapshot, setSnapshot] = useState<ProjectFileSnapshot>();
  const [draft, setDraftState] = useState("");
  const [prepared, setPrepared] = useState<PreparedProjectFileEdit>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const current = ++request.current;
    if (!fileId) {
      setSnapshot(undefined);
      setDraftState("");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const next = await runLocalOperation<ProjectFileSnapshot>({ type: "read-project-file", fileId });
      if (request.current !== current) return;
      setSnapshot(next);
      setDraftState(next.source);
      setPrepared(undefined);
    } catch (reason) {
      if (request.current === current) setError(messageFor(reason));
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  const setDraft = (source: string) => {
    setDraftState(source);
    setPrepared(undefined);
    setError(undefined);
  };
  const reset = () => {
    setDraftState(snapshot?.source ?? "");
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
      });
      setPrepared(next);
      return next;
    } catch (reason) {
      if (reason instanceof LocalOperationError && reason.code === "STALE_SOURCE") void load();
      setError(messageFor(reason));
      return undefined;
    }
  }, [draft, load, snapshot]);
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
