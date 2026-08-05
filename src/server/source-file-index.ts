import { createHash } from "node:crypto";
import { lstat, opendir, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";

import {
  designSpaceAreas,
  designSpaceDevices,
  type DesignSpaceArea,
  type DesignSpaceDevice,
  type DesignSpaceProjectConfig,
  type SourceWorkspaceDeviceState,
  type SourceWorkspaceEntry,
  type SourceWorkspaceManifest,
  type SourceWorkspaceLibrary,
} from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { readRegisteredFile } from "./registered-file-reader";
import { indexSourceDesigns, sourceDesignKey } from "./source-design-index";
import { indexTypeScriptComponents } from "./typescript-component-index";

const SOURCE_ROOT = "src/app" as const;
const maximumIndexedFiles = 2_000;
const maximumDirectoryDepth = 24;
const ignoredDirectories = new Set([
  ".expo",
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const safeSourceExtensions = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".scss", ".svg", ".ts", ".tsx",
]);
const safeRootFiles = new Set([
  ".designspace.ts",
  "Dockerfile",
  "app.json",
  "index.html",
  "metro.config.js",
  "metro.config.ts",
  "nginx.conf",
  "package.json",
  "project-template-origin.json",
  "tsconfig.json",
  "vite.config.js",
  "vite.config.ts",
]);

export interface IndexedSourceFile {
  id: string;
  relativePath: string;
  absolutePath: string;
}

export interface IndexedSourceWorkspace {
  root: string;
  manifest: SourceWorkspaceManifest;
  files: readonly IndexedSourceFile[];
  entryFiles: ReadonlyMap<string, string>;
  stylePaths: readonly string[];
}

export async function indexSourceWorkspace(
  unsafeRoot: string,
  config: DesignSpaceProjectConfig,
): Promise<IndexedSourceWorkspace> {
  const root = await canonicalRoot(unsafeRoot);
  const relativePaths = await discoverBrowsableFiles(root);
  const files = await registerDiscoveredFiles(root, relativePaths);
  const fileByPath = new Map(files.map((file) => [file.relativePath, file]));
  const conventionCandidates = files.filter((file) => sourceLocation(file.relativePath));
  const inferredCatalog = Boolean(config.source?.layout) || conventionCandidates.length === 0;
  const componentCandidates = inferredCatalog
    ? files.filter((file) => !isDesignModule(file.relativePath) && inferredSourceLocation(file.relativePath, config))
    : conventionCandidates;
  const indexedComponents = await indexTypeScriptComponents({
    projectRoot: root,
    filePaths: componentCandidates.map((file) => file.absolutePath),
  });
  const indexedDesigns = await indexSourceDesigns(root, files);

  const entries: SourceWorkspaceEntry[] = [];
  const entryFiles = new Map<string, string>();
  for (const component of indexedComponents) {
    const relativePath = isAbsolute(component.filePath)
      ? portableRelative(root, component.filePath)
      : component.filePath.replaceAll("\\", "/");
    const location = sourceLocation(relativePath) ?? (inferredCatalog ? inferredSourceLocation(relativePath, config) : undefined);
    const file = fileByPath.get(relativePath);
    if (!location || !file) continue;
    const id = stableId("source.entry", `${relativePath}\0${component.exportName}`);
    if (entryFiles.has(id)) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The TypeScript source index produced duplicate entries");
    }
    entries.push({
      id,
      label: component.label,
      area: location.area,
      device: location.device,
      fileId: file.id,
      relativePath,
      exportName: component.exportName,
      props: component.props,
      slots: component.slots,
      findings: component.findings,
      source: component.source,
      uses: component.uses,
      layers: component.layers,
      previewable: true,
      ...componentDesign(indexedDesigns, relativePath, component.exportName),
    });
    entryFiles.set(id, file.absolutePath);
  }
  entries.sort(compareEntries);

  const manifest: SourceWorkspaceManifest = {
    runtime: config.runtime ?? "react",
    sourceRoot: inferredCatalog ? inferredSourceRoot(config) : SOURCE_ROOT,
    entries: Object.freeze(entries),
    devices: Object.freeze(deviceStates(entries, config)),
    library: await detectComponentLibrary(root, fileByPath.get("package.json"), files),
  };
  return {
    root,
    manifest: Object.freeze(manifest),
    files: Object.freeze(files),
    entryFiles,
    stylePaths: Object.freeze(files.filter((file) => extname(file.relativePath) === ".css").map((file) => file.absolutePath)),
  };
}

async function detectComponentLibrary(
  root: string,
  packageFile: IndexedSourceFile | undefined,
  files: readonly IndexedSourceFile[],
): Promise<SourceWorkspaceLibrary | undefined> {
  if (!packageFile) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(await readRegisteredFile(root, packageFile.absolutePath));
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const manifest = value as Record<string, unknown>;
  const dependencies = ["dependencies", "devDependencies", "peerDependencies"].reduce<Record<string, string>>(
    (result, key) => {
      const section = manifest[key];
      if (!section || typeof section !== "object" || Array.isArray(section)) return result;
      for (const [name, version] of Object.entries(section)) {
        if (typeof version === "string" && result[name] === undefined) result[name] = version;
      }
      return result;
    },
    {},
  );
  const packageName = [
    "@dotnaos/react-ui",
    "@dotnaos/react-native-ui",
    "@dotnaos/ui",
    ...Object.keys(dependencies).filter((name) => /^@dotnaos\/.*(?:ui|components)/i.test(name)),
  ].find((name) => dependencies[name] !== undefined);
  if (!packageName) return undefined;
  const version = dependencies[packageName];
  const development = /^(?:file|link|workspace):/.test(version);
  const exported = resolvedLibraryComponents(root, packageName);
  const components = exported.length ? exported : await importedLibraryComponents(root, files, packageName);
  return {
    packageName,
    version,
    mode: development ? "development" : "release",
    // A linked package proves which source is in use, but it is not editable
    // until that second root has its own trusted write registration.
    editable: false,
    components,
  };
}

function resolvedLibraryComponents(
  root: string,
  packageName: string,
): SourceWorkspaceLibrary["components"] {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  let options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  if (configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!config.error) options = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath).options;
  }
  const resolved = ts.resolveModuleName(packageName, resolve(root, "src/design-space-library-catalog.ts"), options, ts.sys).resolvedModule;
  if (!resolved?.resolvedFileName || !/\.d\.[cm]?ts$/.test(resolved.resolvedFileName)) return [];
  const program = ts.createProgram([resolved.resolvedFileName], options);
  const source = program.getSourceFile(resolved.resolvedFileName);
  const checker = program.getTypeChecker();
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!moduleSymbol) return [];
  const candidates = checker.getExportsOfModule(moduleSymbol).flatMap((symbol) => {
    const name = symbol.getName();
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name) || name === name.toUpperCase()) return [];
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    if (!(target.flags & ts.SymbolFlags.Value)) return [];
    const primitive = target.declarations?.some((declaration) => (
      /[/\\]primitives[/\\]/.test(declaration.getSourceFile().fileName)
    ));
    return [{
      target,
      name,
      evidence: "package-export" as const,
      ...(primitive ? { category: "primitive" as const } : {}),
    }];
  });
  const componentsByTarget = new Map<ts.Symbol, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const current = componentsByTarget.get(candidate.target);
    if (!current || (candidate.name === candidate.target.getName() && current.name !== candidate.target.getName())) {
      componentsByTarget.set(candidate.target, candidate);
    }
  }
  const components = [...componentsByTarget.values()].map(({ target: _target, ...component }) => component);
  return Object.freeze(
    [...new Map(components.map((component) => [component.name, component])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, "en")),
  );
}

async function importedLibraryComponents(
  root: string,
  files: readonly IndexedSourceFile[],
  packageName: string,
): Promise<SourceWorkspaceLibrary["components"]> {
  const names = new Set<string>();
  const escapedPackage = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namedImport = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escapedPackage}["']`, "g");
  for (const file of files) {
    if (!/\.[cm]?[jt]sx?$/.test(file.relativePath)) continue;
    const source = await readRegisteredFile(root, file.absolutePath, { maximumBytes: 512 * 1024 }).catch(() => undefined);
    if (!source) continue;
    for (const match of source.matchAll(namedImport)) {
      for (const imported of (match[1] ?? "").split(",")) {
        const name = imported.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
        if (name && /^[A-Z][A-Za-z0-9_$]*$/.test(name)) names.add(name);
      }
    }
  }
  return Object.freeze([...names].sort((left, right) => left.localeCompare(right, "en")).map((name) => ({
    name,
    evidence: "project-import" as const,
  })));
}

async function discoverBrowsableFiles(root: string): Promise<string[]> {
  const result = new Set<string>();
  for (const file of safeRootFiles) {
    if (await isSafeFile(resolve(root, file))) result.add(file);
  }
  for (const directory of ["app", "public", "src"] as const) {
    await walkDirectory(root, directory, 0, result);
  }
  return [...result].sort((left, right) => left.localeCompare(right, "en"));
}

function inferredSourceRoot(config: DesignSpaceProjectConfig): string {
  return config.source?.layout.startsWith("app/") ? "app" : "src";
}

async function walkDirectory(root: string, relativeDirectory: string, depth: number, result: Set<string>): Promise<void> {
  if (depth > maximumDirectoryDepth || ignoredDirectories.has(relativeDirectory.split("/").at(-1) ?? "")) return;
  const directoryMetadata = await lstat(resolve(root, relativeDirectory)).catch(() => undefined);
  if (!directoryMetadata?.isDirectory() || directoryMetadata.isSymbolicLink()) return;
  let directory;
  try {
    directory = await opendir(resolve(root, relativeDirectory));
  } catch {
    return;
  }
  for await (const entry of directory) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    const absolutePath = resolve(root, relativePath);
    const metadata = await lstat(absolutePath).catch(() => undefined);
    if (!metadata || metadata.isSymbolicLink()) continue;
    if (metadata.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walkDirectory(root, relativePath, depth + 1, result);
      continue;
    }
    if (!metadata.isFile() || !safeSourceExtensions.has(extname(entry.name).toLowerCase())) continue;
    result.add(relativePath);
    if (result.size > maximumIndexedFiles) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The source project contains too many browsable files");
    }
  }
}

async function registerDiscoveredFiles(root: string, relativePaths: readonly string[]): Promise<IndexedSourceFile[]> {
  const files: IndexedSourceFile[] = [];
  const ids = new Set<string>();
  for (const relativePath of relativePaths) {
    const id = stableId("source.file", relativePath);
    if (ids.has(id)) throw new DesignSpaceError("INVALID_REGISTRATION", "The source file index contains duplicate IDs");
    ids.add(id);
    files.push({ id, relativePath, absolutePath: await canonicalRegisteredFile(root, relativePath) });
  }
  return files;
}

function sourceLocation(relativePath: string): { area: DesignSpaceArea; device: DesignSpaceDevice } | undefined {
  const layout = /^src\/app\/(desktop|tablet|mobile)\/layout\.tsx?$/.exec(relativePath);
  if (layout) return { area: "layout", device: layout[1] as DesignSpaceDevice };

  const page = /^src\/app\/(desktop|tablet|mobile)\/pages\/.+\.tsx?$/.exec(relativePath);
  if (page) return { area: "pages", device: page[1] as DesignSpaceDevice };

  const component = /^src\/app\/components\/[^/]+\/(desktop|tablet|mobile|index)\.tsx?$/.exec(relativePath);
  if (component) {
    return { area: "components", device: component[1] === "index" ? "desktop" : component[1] as DesignSpaceDevice };
  }

  return undefined;
}

function inferredSourceLocation(
  relativePath: string,
  config: DesignSpaceProjectConfig,
): { area: DesignSpaceArea; device: DesignSpaceDevice } | undefined {
  if (!relativePath.endsWith(".tsx") || /(?:^|\/)[^/]+\.(?:test|spec|stories|design)\.tsx$/.test(relativePath)) return undefined;
  const device = inferredDevice(relativePath);
  const fileName = relativePath.split("/").at(-1) ?? relativePath;
  const configuredLayout = config.source?.layout;
  const area: DesignSpaceArea = configuredLayout ? relativePath === configuredLayout
    ? "layout"
    : /(?:^|\/)components(?:\/|$)/i.test(relativePath)
      ? "components"
      : "pages"
    : /(?:^|\/)app(?:-entry)?\.tsx$/i.test(relativePath)
    ? "layout"
    : /(?:^|\/)pages(?:\/|$)/i.test(relativePath) || /(?:Page|-page)\.tsx$/.test(fileName)
      ? "pages"
      : "components";
  return { area, device };
}

function isDesignModule(relativePath: string): boolean {
  return relativePath.endsWith(".design.tsx");
}

function componentDesign(
  designs: ReadonlyMap<string, { design: IndexedSourceFile }>,
  sourcePath: string,
  exportName: string,
): Pick<SourceWorkspaceEntry, "design"> {
  const file = designs.get(sourceDesignKey(sourcePath, exportName))?.design;
  return file ? { design: { fileId: file.id, relativePath: file.relativePath } } : {};
}

function inferredDevice(relativePath: string): DesignSpaceDevice {
  if (/(?:^|\/|[.-])mobile(?:\/|[.-]|$)/i.test(relativePath)) return "mobile";
  if (/(?:^|\/|[.-])tablet(?:\/|[.-]|$)/i.test(relativePath)) return "tablet";
  return "desktop";
}

function deviceStates(
  entries: readonly SourceWorkspaceEntry[],
  config: DesignSpaceProjectConfig,
): SourceWorkspaceDeviceState[] {
  return designSpaceAreas.flatMap((area) => designSpaceDevices.map((device) => {
    const path = sourcePath(area, device);
    if (config.devices?.mode === "responsive" && entries.some((entry) => entry.area === area)) {
      return { area, device, path, state: "responsive" } as const;
    }
    if (entries.some((entry) => entry.area === area && entry.device === device)) {
      return { area, device, path, state: "configured" } as const;
    }
    const fallback = device === "tablet" ? config.tablet?.fallback : undefined;
    if (fallback && entries.some((entry) => entry.area === area && entry.device === fallback)) {
      return { area, device, path, state: "fallback", fallback } as const;
    }
    return { area, device, path, state: "missing" } as const;
  }));
}

function sourcePath(area: DesignSpaceArea, device: DesignSpaceDevice): string {
  if (area === "layout") return `${SOURCE_ROOT}/${device}/layout.tsx`;
  if (area === "pages") return `${SOURCE_ROOT}/${device}/pages`;
  return `${SOURCE_ROOT}/components/*/${device}.tsx`;
}

async function isSafeFile(path: string): Promise<boolean> {
  const metadata = await lstat(path).catch(() => undefined);
  if (!metadata?.isFile() || metadata.isSymbolicLink()) return false;
  const canonical = await realpath(path).catch(() => undefined);
  return canonical === path;
}

function portableRelative(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join("/");
}

function stableId(prefix: string, value: string): string {
  return `${prefix}.${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function compareEntries(left: SourceWorkspaceEntry, right: SourceWorkspaceEntry): number {
  return designSpaceAreas.indexOf(left.area) - designSpaceAreas.indexOf(right.area)
    || designSpaceDevices.indexOf(left.device) - designSpaceDevices.indexOf(right.device)
    || left.relativePath.localeCompare(right.relativePath, "en")
    || left.exportName.localeCompare(right.exportName, "en");
}
