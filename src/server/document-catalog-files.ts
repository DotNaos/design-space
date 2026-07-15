import { posix } from "node:path";

import type { DocumentCatalogFileEntry } from "../shared/document-transactions";
import { sourceVersion } from "./source-editor";
import type { RegisteredTarget } from "./target-registration";

export function registeredFileCatalog(target: RegisteredTarget): readonly DocumentCatalogFileEntry[] {
  const entries: DocumentCatalogFileEntry[] = [];
  const directoryIds = new Map<string, string>();
  const usedIds = new Set(target.files.keys());
  const files = [...target.files.values()].sort((left, right) => (
    left.displayName.localeCompare(right.displayName, "en") || left.id.localeCompare(right.id, "en")
  ));

  for (const file of files) {
    const segments = file.displayName.replaceAll("\\", "/").split("/").filter(Boolean);
    let parentId: string | undefined;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const directoryPath = posix.join(...segments.slice(0, index + 1));
      let directoryId = directoryIds.get(directoryPath);
      if (!directoryId) {
        directoryId = uniqueDirectoryId(directoryPath, usedIds);
        directoryIds.set(directoryPath, directoryId);
        usedIds.add(directoryId);
        entries.push({ id: directoryId, label: segments[index], kind: "directory", parentId });
      }
      parentId = directoryId;
    }
    entries.push({
      id: file.id,
      label: segments.at(-1) ?? file.displayName,
      kind: "file",
      parentId,
    });
  }
  return entries;
}

function uniqueDirectoryId(path: string, usedIds: ReadonlySet<string>): string {
  const digest = sourceVersion(path).slice(0, 32);
  let id = `catalog.directory.${digest}`;
  let suffix = 1;
  while (usedIds.has(id)) id = `catalog.directory.${digest}.${suffix++}`;
  return id;
}
