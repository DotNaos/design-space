import { useEffect, useState } from "react";

import type { ProjectFileCatalog } from "../../shared/contracts";
import type { RuntimeSourceWorkspace, SourceWorkspaceFileEntry } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";

export function useSourceWorkspaceFiles(
  scope: "app" | "library-development",
  appFiles: readonly SourceWorkspaceFileEntry[],
  developmentWorkspace?: RuntimeSourceWorkspace,
  includeIgnored = false,
  onIgnoredFileCountChange?: (count: number) => void,
): readonly SourceWorkspaceFileEntry[] {
  const [libraryFiles, setLibraryFiles] = useState<readonly SourceWorkspaceFileEntry[]>([]);

  useEffect(() => {
    if (scope === "app") {
      onIgnoredFileCountChange?.(0);
      return;
    }
    let current = true;
    setLibraryFiles([]);
    void runLocalOperation<ProjectFileCatalog>({
      type: "list-project-files",
      scope,
      ...(includeIgnored ? { includeIgnored: true } : {}),
    })
      .then((catalog) => {
        if (current) {
          setLibraryFiles(catalog.files);
          onIgnoredFileCountChange?.(catalog.ignoredFileCount ?? catalog.files.filter((file) => file.ignored).length);
        }
      })
      .catch(() => {
        if (current) {
          setLibraryFiles([]);
          onIgnoredFileCountChange?.(0);
        }
      });
    return () => {
      current = false;
    };
  }, [developmentWorkspace, includeIgnored, onIgnoredFileCountChange, scope]);

  return scope === "app" ? appFiles : libraryFiles;
}
