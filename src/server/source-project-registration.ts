import type { DesignSpaceProjectConfig } from "../shared/source-workspace";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { verifySourceComponentApprovals } from "./source-approval-registration";
import { indexSourceWorkspace } from "./source-file-index";
import { indexAppManifestWorkspace } from "./source-file-index";
import type { AppManifest } from "./app-manifest";
import { registerSourceComponentStore } from "./source-component-creation";
import { resolveConfiguredLibraryDevelopmentRoot } from "./library-development-project";
import { loadSourceLibraryRepository } from "./source-library-repository";
import type { RegisteredTarget } from "./target-registration";

export async function registerSourceProject(
  unsafeRoot: string,
  config: DesignSpaceProjectConfig,
): Promise<RegisteredTarget> {
  const root = await canonicalRoot(unsafeRoot);
  const registrationPath = await canonicalRegisteredFile(root, ".designspace.ts");
  const sourceWorkspace = await indexRegisteredSourceWorkspace(root, config);
  const sourceLibrary = await registerSourceLibrary(root, config, sourceWorkspace.manifest.library);
  const sourceRoot = sourceWorkspace.manifest.sourceRoot;
  const editableSourceRoot = sourceRoot === "src/app" ? "src" : sourceRoot;
  const sourceComponentStore = await registerSourceComponentStore(
    root,
    componentStoreDirectory(config, sourceRoot),
    config.devices?.mode === "responsive" ? "index.tsx" : "desktop.tsx",
  );
  const editableFileIds = new Set(
    sourceWorkspace.files
      .filter((file) => isEditableTypeScriptSource(file.relativePath, editableSourceRoot))
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
    ...(config.approvals ? {
      sourceApproval: {
        policy: config.approvals.policy ?? ".project/approvals/policy.yaml",
      },
    } : {}),
    sourceComponentStore,
    sourceLibrary,
    libraryProject: config.library?.project,
  };
}

export async function registerAppManifestProject(
  unsafeRoot: string,
  manifestPath: string,
  manifest: AppManifest,
): Promise<RegisteredTarget> {
  const root = await canonicalRoot(unsafeRoot);
  const registrationPath = await canonicalRegisteredFile(root, manifestPath);
  for (const [targetId, target] of Object.entries(manifest.targets)) {
    const targetRoot = await canonicalRoot(resolve(root, target.sourceRoot));
    const traversal = relative(root, targetRoot);
    if (traversal === ".." || traversal.startsWith(`..${sep}`) || isAbsolute(traversal)) {
      throw new DesignSpaceError("INVALID_REGISTRATION", `targets.${targetId}.sourceRoot escapes the project root`);
    }
    await canonicalRegisteredFile(root, target.entrypoint);
    await Promise.all(Object.values(target.devices).map((device) => (
      canonicalRegisteredFile(root, device!.root.source)
    )));
  }
  const sourceWorkspace = await indexAppManifestWorkspace(root, manifest);
  const sourceRoots = sourceWorkspace.manifest.targets?.map((target) => target.sourceRoot) ?? [];
  const editableFileIds = new Set(
    sourceWorkspace.files
      .filter((file) => sourceRoots.some((sourceRoot) => isEditableTypeScriptSource(file.relativePath, sourceRoot)))
      .map((file) => file.id),
  );
  return {
    project: { id: manifest.app.id, label: manifest.app.displayName },
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

async function registerSourceLibrary(
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
  const packageName = configuredPackage ?? detected?.packageName;
  if (!packageName) return undefined;
  const configuredDevelopmentRoot = await resolveConfiguredLibraryDevelopmentRoot(root, config.library);
  const developmentRoot = configuredDevelopmentRoot
    ? await canonicalRoot(configuredDevelopmentRoot)
    : undefined;
  return {
    packageName,
    ...(detected?.mode === "release" ? {
      release: {
        version: detected.version,
        modulePath: await resolveLibraryDesignModule(root, configuredPackage ?? detected.packageName),
      },
    } : {}),
    ...(developmentRoot ? { development: await loadSourceLibraryRepository(developmentRoot) } : {}),
  };
}

async function indexRegisteredSourceWorkspace(root: string, config: DesignSpaceProjectConfig) {
  const workspace = await indexSourceWorkspace(root, config);
  const approvals = await verifySourceComponentApprovals(root, config, workspace.manifest.entries);
  return {
    ...workspace,
    manifest: Object.freeze({
      ...workspace.manifest,
      approvals,
    }),
  };
}

async function resolveLibraryDesignModule(root: string, packageName: string): Promise<string | undefined> {
  const packageRoot = resolve(root, "node_modules", ...packageName.split("/"));
  const manifest = await readFile(resolve(packageRoot, "package.json"), "utf8")
    .then((source) => JSON.parse(source) as { exports?: Record<string, unknown> })
    .catch(() => undefined);
  const designExport = manifest?.exports?.["./designs"];
  const relativePath = typeof designExport === "string"
    ? designExport
    : designExport && typeof designExport === "object" && !Array.isArray(designExport)
      ? ((designExport as Record<string, unknown>).import ?? (designExport as Record<string, unknown>).default)
      : undefined;
  if (typeof relativePath !== "string") return undefined;
  return canonicalRegisteredFile(packageRoot, relativePath.replace(/^\.\//, "")).catch(() => undefined);
}

function isEditableTypeScriptSource(relativePath: string, sourceRoot: string): boolean {
  return relativePath.startsWith(`${sourceRoot}/`) && /\.(?:ts|tsx)$/.test(relativePath);
}

function componentStoreDirectory(config: DesignSpaceProjectConfig, sourceRoot: string): string {
  const layout = config.source?.layout?.replace(/^\.\//, "");
  if (!layout) return `${sourceRoot}/components`;
  const layoutDirectory = layout.slice(0, Math.max(0, layout.lastIndexOf("/")));
  return `${layoutDirectory}/components`;
}
