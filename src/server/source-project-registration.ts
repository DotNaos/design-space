import type { DesignSpaceProjectConfig } from "../shared/source-workspace";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { indexSourceWorkspace } from "./source-file-index";
import type { RegisteredTarget } from "./target-registration";

export async function registerSourceProject(
  unsafeRoot: string,
  config: DesignSpaceProjectConfig,
): Promise<RegisteredTarget> {
  const root = await canonicalRoot(unsafeRoot);
  const registrationPath = await canonicalRegisteredFile(root, ".designspace.ts");
  const sourceWorkspace = await indexSourceWorkspace(root, config);
  const editableFileIds = new Set(sourceWorkspace.manifest.entries.map((entry) => entry.fileId));
  return {
    project: config.project,
    root,
    targetModulePath: registrationPath,
    registrationPath,
    files: new Map(sourceWorkspace.files.map((file) => [file.id, {
      id: file.id,
      path: file.absolutePath,
      displayName: file.relativePath,
    }])),
    editTargets: new Map(),
    editableFileIds,
    sourceWorkspace,
  };
}
