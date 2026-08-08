import { opendir, readFile, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { runnerImport } from "vite";

import {
  designSpaceAreas,
  designSpaceDevices,
  type DesignSpaceProjectConfig,
  type SourceApprovalEvidence,
  type SourceWorkspaceDeviceState,
  type SourceWorkspaceFolderIcon,
  type SourceWorkspacePackage,
} from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { verifySourceComponentApprovals } from "./source-approval-registration";
import {
  countIgnoredRepositoryFiles,
  discoverRepositoryFiles,
  indexSourceWorkspace,
  type IndexedSourceFile,
  type IndexedSourceWorkspace,
} from "./source-file-index";
import { parseSourceProjectConfig } from "./source-project-config";

const ignoredDirectories = new Set([
  ".expo",
  ".git",
  ".next",
  ".turbo",
  ".worktrees",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const maximumPackageDepth = 16;
const maximumPackages = 200;

interface DiscoveredPackage {
  directory: string;
  manifestPath: string;
  name: string;
}

interface IndexedPackage {
  pkg: SourceWorkspacePackage;
  workspace: IndexedSourceWorkspace;
}

/**
 * Loads a component-library repository as one source workspace while retaining
 * the real package manifests as presentation-only catalog boundaries.
 */
export async function loadSourceLibraryRepository(unsafeRoot: string): Promise<IndexedSourceWorkspace> {
  const root = await canonicalRoot(unsafeRoot);
  const packages = await discoverSourceLibraryPackages(root);
  const indexed = await Promise.all(packages.map((pkg) => indexPackage(root, pkg)));
  return mergePackageWorkspaces(root, indexed.filter((candidate): candidate is IndexedPackage => Boolean(candidate)));
}

export async function discoverSourceLibraryPackages(unsafeRoot: string): Promise<readonly DiscoveredPackage[]> {
  const root = await canonicalRoot(unsafeRoot);
  const manifestPaths: string[] = [];
  await walkPackageManifests(root, ".", 0, manifestPaths);
  const packages = await Promise.all(manifestPaths.map(async (manifestPath) => {
    const absolutePath = await canonicalRegisteredFile(root, manifestPath);
    const manifest = await readFile(absolutePath, "utf8")
      .then((source) => JSON.parse(source) as { name?: unknown })
      .catch(() => undefined);
    const name = typeof manifest?.name === "string" ? manifest.name.trim() : "";
    if (!name) return undefined;
    return {
      directory: portableDirectory(dirname(manifestPath)),
      manifestPath,
      name,
    };
  }));
  const discovered = packages
    .filter((pkg): pkg is DiscoveredPackage => Boolean(pkg))
    .sort((left, right) => left.directory.localeCompare(right.directory, "en"));
  const names = new Set<string>();
  for (const pkg of discovered) {
    if (!/^@?[a-z0-9][a-z0-9._/-]*$/i.test(pkg.name) || pkg.name.length > 160) {
      throw new DesignSpaceError("INVALID_REGISTRATION", `Package ${pkg.directory} has an invalid name`);
    }
    if (names.has(pkg.name)) {
      throw new DesignSpaceError("INVALID_REGISTRATION", `Package name ${pkg.name} is declared more than once`);
    }
    names.add(pkg.name);
  }
  return Object.freeze(discovered);
}

async function indexPackage(root: string, pkg: DiscoveredPackage): Promise<IndexedPackage | undefined> {
  const config = await packageConfig(root, pkg);
  const workspace = await indexSourceWorkspace(root, repositoryRelativeConfig(pkg.directory, config));
  if (!workspace.manifest.entries.some((entry) => entry.design)) return undefined;
  const approvals = await verifySourceComponentApprovals(
    root,
    repositoryRelativeConfig(pkg.directory, config),
    workspace.manifest.entries,
  );
  return {
    pkg: { directory: pkg.directory, name: pkg.name },
    workspace: {
      ...workspace,
      manifest: Object.freeze({ ...workspace.manifest, approvals }),
    },
  };
}

async function packageConfig(root: string, pkg: DiscoveredPackage): Promise<DesignSpaceProjectConfig> {
  const configPath = packagePath(pkg.directory, ".designspace.ts");
  const registeredConfig = await canonicalRegisteredFile(root, configPath).catch(() => undefined);
  if (registeredConfig) {
    const { module } = await runnerImport<Record<string, unknown>>(registeredConfig, {
      root,
      logLevel: "silent",
    });
    return parseSourceProjectConfig(module.default ?? module.designSpace);
  }
  const id = pkg.name
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^[^a-z]+/i, "")
    .slice(0, 96) || "component-library";
  return {
    project: { id, label: pkg.name },
    devices: { mode: "responsive" },
  };
}

function repositoryRelativeConfig(
  packageDirectory: string,
  config: DesignSpaceProjectConfig,
): DesignSpaceProjectConfig {
  const layout = config.source?.layout?.replace(/^\.\//, "")
    ?? "src/__designspace_inferred__.tsx";
  const components = config.source?.components?.replace(/^\.\//, "");
  const policy = config.approvals?.policy?.replace(/^\.\//, "");
  return {
    ...config,
    source: {
      layout: packagePath(packageDirectory, layout),
      ...(components ? { components: packagePath(packageDirectory, components) } : {}),
    },
    ...(config.approvals ? {
      approvals: { ...config.approvals, ...(policy ? { policy: packagePath(packageDirectory, policy) } : {}) },
    } : {}),
  };
}

async function mergePackageWorkspaces(root: string, indexed: readonly IndexedPackage[]): Promise<IndexedSourceWorkspace> {
  const files = uniqueFiles(indexed.flatMap(({ workspace }) => workspace.files));
  const catalogFiles = uniqueFiles(await discoverRepositoryFiles(root));
  const ignoredFileCount = await countIgnoredRepositoryFiles(root);
  const entryFiles = new Map<string, string>();
  const entries = indexed.flatMap(({ workspace }) => {
    for (const [id, path] of workspace.entryFiles) {
      const existing = entryFiles.get(id);
      if (existing && existing !== path) {
        throw new DesignSpaceError("INVALID_REGISTRATION", "Library packages produced duplicate component identities");
      }
      entryFiles.set(id, path);
    }
    return workspace.manifest.entries;
  }).sort((left, right) => (
    left.relativePath.localeCompare(right.relativePath, "en")
    || left.exportName.localeCompare(right.exportName, "en")
  ));
  const runtimes = new Set(indexed.map(({ workspace }) => workspace.manifest.runtime));
  if (runtimes.size > 1) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Component-library packages must use one preview runtime");
  }
  const styles = [...new Set(indexed.flatMap(({ workspace }) => workspace.stylePaths))];
  const packages = Object.freeze(indexed.map(({ pkg }) => pkg));
  const componentRoot = commonComponentRoot(packages);
  const componentRoots = Object.freeze(indexed
    .map(({ workspace }) => workspace.manifest.componentRoot)
    .filter((root): root is string => Boolean(root)));
  const sourceRoots = Object.freeze([...new Set(indexed.map(({ workspace }) => workspace.manifest.sourceRoot))]);
  const editableFileIds = new Set(indexed.flatMap(({ workspace }) => workspace.files
    .filter((file) => (
      isPathWithin(file.relativePath, workspace.manifest.sourceRoot)
      && /\.[cm]?tsx?$/.test(file.relativePath)
    ))
    .map((file) => file.id)));
  return {
    root,
    files: Object.freeze(files),
    catalogFiles: Object.freeze(catalogFiles),
    ignoredFileCount,
    entryFiles,
    stylePaths: Object.freeze(styles),
    sourceRoots,
    editableFileIds,
    manifest: Object.freeze({
      adapter: "legacy",
      runtime: indexed[0]?.workspace.manifest.runtime ?? "react",
      sourceRoot: ".",
      ...(componentRoot ? { componentRoot } : {}),
      ...(componentRoots.length ? { componentRoots } : {}),
      entries: Object.freeze(entries),
      devices: mergeDeviceStates(indexed),
      folderIcons: mergeFolderIcons(indexed),
      packageDirectories: Object.freeze(packages
        .map((pkg) => pkg.directory)
        .filter((directory) => directory !== ".")),
      packages,
      approvals: mergeApprovals(indexed),
    }),
  };
}

function commonComponentRoot(packages: readonly SourceWorkspacePackage[]): string | undefined {
  const directories = packages.map((pkg) => pkg.directory).filter((directory) => directory !== ".");
  if (!directories.length || !directories.every((directory) => directory === "components" || directory.startsWith("components/"))) {
    return undefined;
  }
  return "components";
}

function uniqueFiles(files: readonly IndexedSourceFile[]): IndexedSourceFile[] {
  const unique = new Map<string, IndexedSourceFile>();
  for (const file of files) {
    const existing = unique.get(file.id);
    if (existing && existing.absolutePath !== file.absolutePath) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "Library packages produced duplicate file identities");
    }
    unique.set(file.id, file);
  }
  return [...unique.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
}

function mergeDeviceStates(indexed: readonly IndexedPackage[]): readonly SourceWorkspaceDeviceState[] {
  return Object.freeze(designSpaceAreas.flatMap((area) => designSpaceDevices.map((device) => {
    const states = indexed.flatMap(({ workspace }) => (
      workspace.manifest.devices.filter((candidate) => candidate.area === area && candidate.device === device)
    ));
    const responsive = states.find((candidate) => candidate.state === "responsive");
    if (responsive) return responsive;
    const configured = states.find((candidate) => candidate.state === "configured");
    if (configured) return configured;
    const fallback = states.find((candidate) => candidate.state === "fallback");
    if (fallback) return fallback;
    return { area, device, path: states[0]?.path ?? `${area}/${device}`, state: "missing" as const };
  })));
}

function mergeFolderIcons(indexed: readonly IndexedPackage[]): readonly SourceWorkspaceFolderIcon[] {
  const icons = new Map<string, SourceWorkspaceFolderIcon>();
  const conflicts = new Set<string>();
  for (const icon of indexed.flatMap(({ workspace }) => workspace.manifest.folderIcons ?? [])) {
    const existing = icons.get(icon.directory);
    if (existing && existing.name !== icon.name) {
      icons.delete(icon.directory);
      conflicts.add(icon.directory);
    } else if (!conflicts.has(icon.directory)) {
      icons.set(icon.directory, icon);
    }
  }
  return Object.freeze([...icons.values()].sort((left, right) => left.directory.localeCompare(right.directory, "en")));
}

function mergeApprovals(indexed: readonly IndexedPackage[]): SourceApprovalEvidence {
  const approvals = indexed.map(({ workspace }) => workspace.manifest.approvals).filter(Boolean);
  const configured = approvals.filter((approval) => approval!.status !== "not-configured");
  if (!configured.length) {
    return {
      status: "not-configured",
      reason: "Cryptographic component approvals are not configured for these packages.",
      components: {},
    };
  }
  const unavailable = configured.find((approval) => approval!.status === "unavailable");
  const policyIds = [...new Set(configured.map((approval) => approval!.policyId).filter(Boolean))];
  return {
    status: unavailable ? "unavailable" : "verified",
    ...(policyIds.length === 1 ? { policyId: policyIds[0] } : {}),
    ...(unavailable?.reason ? { reason: unavailable.reason } : {}),
    components: Object.assign({}, ...configured.map((approval) => approval!.components)),
  };
}

function isPathWithin(path: string, directory: string): boolean {
  return directory === "." || path === directory || path.startsWith(`${directory}/`);
}

async function walkPackageManifests(
  root: string,
  relativeDirectory: string,
  depth: number,
  result: string[],
): Promise<void> {
  if (depth > maximumPackageDepth) return;
  const absoluteDirectory = resolve(root, relativeDirectory);
  if (await realpath(absoluteDirectory).catch(() => undefined) !== absoluteDirectory) return;
  const directory = await opendir(absoluteDirectory).catch(() => undefined);
  if (!directory) return;
  for await (const entry of directory) {
    if (entry.isSymbolicLink()) continue;
    const relativePath = packagePath(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walkPackageManifests(root, relativePath, depth + 1, result);
      continue;
    }
    if (!entry.isFile() || entry.name !== "package.json") continue;
    result.push(relativePath);
    if (result.length > maximumPackages) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The component-library repository contains too many packages");
    }
  }
}

function packagePath(directory: string, path: string): string {
  return directory === "." ? path : `${directory}/${path}`;
}

function portableDirectory(path: string): string {
  const portable = path.split(sep).join("/");
  return portable && portable !== "" ? portable : ".";
}
