import { useCallback, useEffect, useState } from "react";

import type { RuntimeSourceLibraryCatalog } from "../../shared/source-workspace";
import type { SourceCatalogKind } from "./source-library-catalog";

export type SourceLibraryMode = "development" | "release";

export function useSourceLibraryRuntime(_catalog?: RuntimeSourceLibraryCatalog) {
  const [catalogKind, setCatalogKindState] = useState<SourceCatalogKind>(preferredCatalogKind);
  useEffect(() => {
    try { localStorage.setItem("design-space.library-source", "development"); } catch { /* local preference is optional */ }
  }, []);
  const setMode = useCallback((next: SourceLibraryMode) => {
    if (next !== "development") return;
    try { localStorage.setItem("design-space.library-source", next); } catch { /* local preference is optional */ }
  }, []);
  const setCatalogKind = useCallback((next: SourceCatalogKind) => {
    setCatalogKindState(next);
    try { localStorage.setItem("design-space.library-catalog", next); } catch { /* local preference is optional */ }
  }, []);
  return { catalogKind, mode: "development" as const, setCatalogKind, setMode };
}

function preferredCatalogKind(): SourceCatalogKind {
  try {
    const stored = localStorage.getItem("design-space.library-catalog");
    if (stored === "app" || stored === "library") return stored;
  } catch { /* server rendering and blocked storage default to the UI library */ }
  return "library";
}
