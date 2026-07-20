import { useCallback, useEffect, useState } from "react";

import type { LibraryRuntimeStatus } from "../../shared/contracts";
import type { SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { LocalOperationError, runLocalOperation } from "../api";

export type SourceLibraryMode = "development" | "release";

export function useSourceLibraryRuntime(library?: SourceWorkspaceLibrary) {
  const [status, setStatus] = useState<LibraryRuntimeStatus>();
  const [mode, setModeState] = useState<SourceLibraryMode>(() => preferredMode(library));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const next = await runLocalOperation<LibraryRuntimeStatus>({ type: "get-library-runtime" });
      setStatus(next);
      setError(undefined);
      setModeState((current) => availableMode(current, next));
      return next;
    } catch (caught) {
      setError(operationMessage(caught));
      return undefined;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 2_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const setMode = useCallback((next: SourceLibraryMode) => {
    setModeState(next);
    try { localStorage.setItem("design-space.library-source", next); } catch { /* local preference is optional */ }
  }, []);

  const start = useCallback(async () => {
    setPending(true);
    setError(undefined);
    setMode("development");
    try {
      setStatus(await runLocalOperation<LibraryRuntimeStatus>({ type: "start-library-development" }));
    } catch (caught) {
      setError(operationMessage(caught));
    } finally {
      setPending(false);
    }
  }, [setMode]);

  const stop = useCallback(async () => {
    setPending(true);
    setError(undefined);
    try {
      const next = await runLocalOperation<LibraryRuntimeStatus>({ type: "stop-library-development" });
      setStatus(next);
      if (next.release) setMode("release");
    } catch (caught) {
      setError(operationMessage(caught));
    } finally {
      setPending(false);
    }
  }, [setMode]);

  return { error, mode, pending, refresh, setMode, start, status, stop };
}

function preferredMode(library?: SourceWorkspaceLibrary): SourceLibraryMode {
  try {
    const stored = localStorage.getItem("design-space.library-source");
    if (stored === "development" || stored === "release") return stored;
  } catch { /* server rendering and blocked storage fall back to package evidence */ }
  return library?.mode === "development" ? "development" : "release";
}

function availableMode(current: SourceLibraryMode, status: LibraryRuntimeStatus): SourceLibraryMode {
  if (current === "development" && status.development.configured) return current;
  if (current === "release" && status.release) return current;
  return status.development.configured ? "development" : "release";
}

function operationMessage(error: unknown): string {
  return error instanceof LocalOperationError || error instanceof Error
    ? error.message
    : "The component library operation failed.";
}
