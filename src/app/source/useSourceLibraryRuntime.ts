import { useCallback, useState } from "react";

import type { RuntimeSourceLibraryCatalog } from "../../shared/source-workspace";

export type SourceLibraryMode = "development" | "release";

export function useSourceLibraryRuntime(catalog?: RuntimeSourceLibraryCatalog) {
  const [mode, setModeState] = useState<SourceLibraryMode>(() => preferredMode(catalog));
  const setMode = useCallback((next: SourceLibraryMode) => {
    if (next === "development" && !catalog?.development) return;
    if (next === "release" && !catalog?.release) return;
    setModeState(next);
    try { localStorage.setItem("design-space.library-source", next); } catch { /* local preference is optional */ }
  }, [catalog]);
  const availableMode = mode === "development" && catalog?.development
    ? mode
    : mode === "release" && catalog?.release
      ? mode
      : catalog?.development ? "development" : "release";
  return { mode: availableMode, setMode };
}

function preferredMode(catalog?: RuntimeSourceLibraryCatalog): SourceLibraryMode {
  try {
    const stored = localStorage.getItem("design-space.library-source");
    if (stored === "development" && catalog?.development) return stored;
    if (stored === "release" && catalog?.release) return stored;
  } catch { /* server rendering and blocked storage use available catalog evidence */ }
  return catalog?.development ? "development" : "release";
}
