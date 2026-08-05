import { execFile } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { ViteDevServer } from "vite";

import { libraryReleaseOperationSchema } from "../shared/contracts";
import type { LibraryReleaseStatus, LibraryReleaseVersion } from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import type { OperationExecutor } from "./local-operation-service";
import type { RegisteredTarget } from "./target-registration";

const execFileAsync = promisify(execFile);
const lockFiles = ["bun.lock", "bun.lockb", "pnpm-lock.yaml"] as const;

interface RegistryPackageMetadata {
  "dist-tags"?: Record<string, unknown>;
  versions?: Record<string, { deprecated?: unknown }>;
  time?: Record<string, unknown>;
}

interface LibraryReleaseServiceOptions {
  fetch?: typeof fetch;
  restartDelayMs?: number;
  runInstall?: (manager: "bun" | "pnpm", root: string) => Promise<void>;
}

interface FileSnapshot {
  path: string;
  source?: Uint8Array;
}

export class LibraryReleaseService implements OperationExecutor {
  readonly #target: RegisteredTarget;
  readonly #fetch: typeof fetch;
  readonly #restartDelayMs: number;
  readonly #runInstall: (manager: "bun" | "pnpm", root: string) => Promise<void>;
  #server?: ViteDevServer;

  constructor(target: RegisteredTarget, options: LibraryReleaseServiceOptions = {}) {
    this.#target = target;
    this.#fetch = options.fetch ?? fetch;
    this.#restartDelayMs = options.restartDelayMs ?? 80;
    this.#runInstall = options.runInstall ?? installDependencies;
  }

  attachServer(server: ViteDevServer): void {
    this.#server = server;
  }

  async execute(input: unknown): Promise<LibraryReleaseStatus> {
    const operation = libraryReleaseOperationSchema.safeParse(input);
    if (!operation.success) throw new DesignSpaceError("INVALID_REQUEST", "The library release operation is invalid");
    const packageName = this.#target.sourceLibrary?.packageName;
    if (!packageName) throw new DesignSpaceError("ACCESS_DENIED", "No installed component library is configured");

    if (operation.data.type === "get-library-releases") {
      return this.#status(packageName);
    }

    const metadata = await fetchRegistryMetadata(this.#fetch, packageName);
    if (!metadata.versions?.[operation.data.version]) {
      throw new DesignSpaceError("VALIDATION_ERROR", "The selected library version is no longer available");
    }
    if (!this.#server) throw new DesignSpaceError("VALIDATION_ERROR", "The Design Space dev server is unavailable");
    await this.#install(packageName, operation.data.version);
    const status = await this.#status(packageName, metadata);
    this.#scheduleRestart();
    return status;
  }

  async #status(packageName: string, metadata?: RegistryPackageMetadata): Promise<LibraryReleaseStatus> {
    const packageMetadata = metadata ?? await fetchRegistryMetadata(this.#fetch, packageName);
    const targetManifest = await readDependencyManifest(this.#target.root, packageName);
    return {
      packageName,
      currentVersion: await readInstalledVersion(this.#target.root, packageName),
      requestedVersion: targetManifest?.version,
      latestVersion: stringValue(packageMetadata["dist-tags"]?.latest),
      versions: registryVersions(packageMetadata),
    };
  }

  async #install(packageName: string, version: string): Promise<void> {
    const installRoot = await resolveInstallRoot(this.#target.root, packageName);
    const manifests = [...new Set([resolve(this.#target.root, "package.json"), resolve(installRoot, "package.json")])];
    const snapshots = await Promise.all(manifests.map(readSnapshot));
    const lockSnapshots = await optionalSnapshots(installRoot, lockFiles);

    try {
      await Promise.all(manifests.map((path) => writeDependencyVersion(path, packageName, version)));
      await this.#runInstall(await packageManager(installRoot), installRoot);
    } catch (cause) {
      await Promise.all([...snapshots, ...lockSnapshots].map(restoreSnapshot));
      throw new DesignSpaceError(
        "VALIDATION_ERROR",
        cause instanceof Error ? `The library could not be installed: ${cause.message}` : "The library could not be installed",
      );
    }
  }

  #scheduleRestart(): void {
    const server = this.#server;
    if (!server) throw new DesignSpaceError("VALIDATION_ERROR", "The Design Space dev server is unavailable");
    setTimeout(() => void server.restart(), this.#restartDelayMs);
  }
}

async function fetchRegistryMetadata(fetcher: typeof fetch, packageName: string): Promise<RegistryPackageMetadata> {
  let response: Response;
  try {
    response = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      headers: { accept: "application/json" },
    });
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "The package registry is unavailable");
  }
  if (!response.ok) throw new DesignSpaceError("VALIDATION_ERROR", "The package registry did not return this library");
  const metadata = await response.json() as RegistryPackageMetadata;
  if (!metadata.versions || typeof metadata.versions !== "object") {
    throw new DesignSpaceError("VALIDATION_ERROR", "The package registry response is invalid");
  }
  return metadata;
}

function registryVersions(metadata: RegistryPackageMetadata): LibraryReleaseVersion[] {
  return Object.entries(metadata.versions ?? {})
    .map(([version, value]) => ({
      version,
      publishedAt: stringValue(metadata.time?.[version]),
      deprecated: stringValue(value.deprecated),
    }))
    .filter((entry) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(entry.version))
    .sort((left, right) => compareVersions(right.version, left.version));
}

function compareVersions(left: string, right: string): number {
  const leftParsed = parseVersion(left);
  const rightParsed = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const result = leftParsed.core[index]! - rightParsed.core[index]!;
    if (result) return result;
  }
  if (!leftParsed.prerelease && rightParsed.prerelease) return 1;
  if (leftParsed.prerelease && !rightParsed.prerelease) return -1;
  return (leftParsed.prerelease ?? "").localeCompare(rightParsed.prerelease ?? "", "en", { numeric: true });
}

function parseVersion(version: string): { core: [number, number, number]; prerelease?: string } {
  const [withoutBuild] = version.split("+");
  const [core, prerelease] = withoutBuild!.split("-", 2);
  const [major, minor, patch] = core!.split(".").map(Number);
  return { core: [major!, minor!, patch!], ...(prerelease ? { prerelease } : {}) };
}

async function resolveInstallRoot(targetRoot: string, packageName: string): Promise<string> {
  let directory = resolve(targetRoot);
  let fallback: string | undefined;
  while (true) {
    if (await readDependencyManifest(directory, packageName)) {
      fallback ??= directory;
      if (await hasAnyFile(directory, lockFiles)) return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return fallback ?? resolve(targetRoot);
}

async function readDependencyManifest(root: string, packageName: string): Promise<{ version: string } | undefined> {
  try {
    const value = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as Record<string, unknown>;
    for (const sectionName of ["dependencies", "devDependencies", "peerDependencies"]) {
      const section = value[sectionName];
      if (section && typeof section === "object" && !Array.isArray(section)) {
        const version = (section as Record<string, unknown>)[packageName];
        if (typeof version === "string") return { version };
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function writeDependencyVersion(path: string, packageName: string, version: string): Promise<void> {
  const source = await readFile(path, "utf8");
  const value = JSON.parse(source) as Record<string, unknown>;
  for (const sectionName of ["dependencies", "devDependencies", "peerDependencies"]) {
    const section = value[sectionName];
    if (section && typeof section === "object" && !Array.isArray(section) && packageName in section) {
      (section as Record<string, unknown>)[packageName] = version;
      await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      return;
    }
  }
  throw new Error(`${packageName} is not declared in ${path}`);
}

async function readInstalledVersion(root: string, packageName: string): Promise<string | undefined> {
  let directory = resolve(root);
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, "node_modules", ...packageName.split("/"), "package.json"), "utf8")) as { version?: unknown };
      if (typeof manifest.version === "string") return manifest.version;
    } catch { /* keep walking */ }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

async function packageManager(root: string): Promise<"bun" | "pnpm"> {
  if (await hasAnyFile(root, ["bun.lock", "bun.lockb"])) return "bun";
  if (await hasAnyFile(root, ["pnpm-lock.yaml"])) return "pnpm";
  return "bun";
}

async function installDependencies(manager: "bun" | "pnpm", root: string): Promise<void> {
  await execFileAsync(manager, ["install"], { cwd: root, encoding: "utf8", maxBuffer: 20_000_000 });
}

async function hasAnyFile(root: string, names: readonly string[]): Promise<boolean> {
  for (const name of names) {
    if (await access(resolve(root, name)).then(() => true, () => false)) return true;
  }
  return false;
}

async function optionalSnapshots(root: string, names: readonly string[]): Promise<FileSnapshot[]> {
  return Promise.all(names.map(async (name) => {
    const path = resolve(root, name);
    return readSnapshot(path).catch(() => ({ path }));
  }));
}

async function readSnapshot(path: string): Promise<FileSnapshot> {
  return { path, source: await readFile(path) };
}

async function restoreSnapshot(snapshot: FileSnapshot): Promise<void> {
  if (snapshot.source) await writeFile(snapshot.path, snapshot.source);
  else await rm(snapshot.path, { force: true });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
