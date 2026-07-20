import type { DesignSpaceProjectConfig } from "../shared/source-workspace";
import { resolve } from "node:path";

import { DesignSpaceError } from "./errors";
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
  const libraryRuntime = await registerLibraryRuntime(root, config, sourceWorkspace.manifest.library);
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
    libraryRuntime,
  };
}

async function registerLibraryRuntime(
  root: string,
  config: DesignSpaceProjectConfig,
  detected: import("../shared/source-workspace").SourceWorkspaceLibrary | undefined,
) {
  const configuredPackage = config.library?.package;
  if (configuredPackage && detected && configuredPackage !== detected.packageName) {
    throw new DesignSpaceError(
      "INVALID_REGISTRATION",
      `Configured library ${configuredPackage} does not match detected package ${detected.packageName}`,
    );
  }
  const development = config.library?.development;
  return {
    packageName: configuredPackage ?? detected?.packageName,
    ...(detected?.mode === "release" ? { release: { version: detected.version } } : {}),
    ...(development ? {
      development: {
        root: await canonicalRoot(resolve(root, development.root)),
        command: Object.freeze([...development.command]) as readonly [string, ...string[]],
        portlessName: development.portlessName,
      },
    } : {}),
  };
}

function isEditableTypeScriptSource(relativePath: string): boolean {
  return relativePath.startsWith("src/") && /\.(?:ts|tsx)$/.test(relativePath);
}
