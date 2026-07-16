import type { DesignSpaceProjectConfig } from "../shared/source-workspace";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { indexSourceWorkspace } from "./source-file-index";
import { registerSourceComponentStore } from "./source-component-creation";
import type { RegisteredTarget } from "./target-registration";

export async function registerSourceProject(
  unsafeRoot: string,
  config: DesignSpaceProjectConfig,
): Promise<RegisteredTarget> {
  const root = await canonicalRoot(unsafeRoot);
  const registrationPath = await canonicalRegisteredFile(root, ".designspace.ts");
  const sourceWorkspace = await indexSourceWorkspace(root, config);
  const sourceComponentStore = await registerSourceComponentStore(
    root,
    "src/app/components",
    config.devices?.mode === "responsive" ? "index.tsx" : "desktop.tsx",
  );
  const editableFileIds = new Set(
    sourceWorkspace.files
      .filter((file) => isEditableTypeScriptSource(file.relativePath))
      .map((file) => file.id),
  );
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
    sourceComponentStore,
  };
}

function isEditableTypeScriptSource(relativePath: string): boolean {
  return relativePath.startsWith("src/") && /\.(?:ts|tsx)$/.test(relativePath);
}
