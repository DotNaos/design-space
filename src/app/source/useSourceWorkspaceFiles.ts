import { useEffect, useState } from "react";

import type { ProjectFileCatalog } from "../../shared/contracts";
import type { RuntimeSourceWorkspace, SourceWorkspaceFileEntry } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";

export function useSourceWorkspaceFiles(
  scope: "app" | "library-development",
  appFiles: readonly SourceWorkspaceFileEntry[],
  developmentWorkspace?: RuntimeSourceWorkspace,
): readonly SourceWorkspaceFileEntry[] {
  const [libraryFiles, setLibraryFiles] = useState<readonly SourceWorkspaceFileEntry[]>([]);

  useEffect(() => {
    if (scope === "app") return;
    let current = true;
    setLibraryFiles([]);
    void runLocalOperation<ProjectFileCatalog>({ type: "list-project-files", scope })
      .then((catalog) => {
        if (current) setLibraryFiles(catalog.files);
      })
      .catch(() => {
        if (current) setLibraryFiles([]);
      });
    return () => {
      current = false;
    };
  }, [developmentWorkspace, scope]);

  return scope === "app" ? appFiles : libraryFiles;
}
