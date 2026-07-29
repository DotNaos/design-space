import type { DesignSpaceProjectConfig } from "../shared/source-workspace";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { runnerImport } from "vite";

import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { verifySourceComponentApprovals } from "./source-approval-registration";
import { indexSourceWorkspace } from "./source-file-index";
import { parseSourceProjectConfig } from "./source-project-config";
import { registerSourceComponentStore } from "./source-component-creation";
import type { RegisteredTarget } from "./target-registration";

export async function registerSourceProject(
  unsafeRoot: string,
  config: DesignSpaceProjectConfig,
): Promise<RegisteredTarget> {
  const root = await canonicalRoot(unsafeRoot);
  const registrationPath = await canonicalRegisteredFile(root, ".designspace.ts");
  const sourceWorkspace = await indexRegisteredSourceWorkspace(root, config);
  const sourceLibrary = await registerSourceLibrary(root, config, sourceWorkspace.manifest.library);
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
    sourceLibrary,
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
  const development = config.library?.development;
  const developmentRoot = development ? await canonicalRoot(resolve(root, development.root)) : undefined;
  return {
    packageName,
    ...(detected?.mode === "release" ? {
      release: {
        version: detected.version,
        modulePath: await resolveLibraryDesignModule(root, configuredPackage ?? detected.packageName),
      },
    } : {}),
    ...(developmentRoot ? { development: await loadLibraryWorkspace(developmentRoot) } : {}),
  };
}

async function loadLibraryWorkspace(root: string) {
  const configPath = await canonicalRegisteredFile(root, ".designspace.ts");
  const { module } = await runnerImport<Record<string, unknown>>(configPath, {
    root,
    logLevel: "silent",
  });
  return indexRegisteredSourceWorkspace(root, parseSourceProjectConfig(module.default ?? module.designSpace));
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

function isEditableTypeScriptSource(relativePath: string): boolean {
  return relativePath.startsWith("src/") && /\.(?:ts|tsx)$/.test(relativePath);
}
