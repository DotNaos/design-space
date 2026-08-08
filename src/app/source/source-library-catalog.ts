import type {
  DesignSpaceDevice,
  RuntimeSourceLibraryCatalog,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceFolderIcon,
  SourceWorkspaceLibrary,
  SourceWorkspacePackage,
} from "../../shared/source-workspace";
import { sourceEntryComponentPath, sourceTreeNodes } from "./source-workspace-tree";
import type { SourceLibraryMode } from "./useSourceLibraryRuntime";

export type SourceCatalogKind = "app" | "library";
export type SourceLibraryCategory = "all" | "primitive" | "composed";

export type SourceCatalogComponent = {
  category: Exclude<SourceLibraryCategory, "all"> | "app";
  entry?: RuntimeSourceWorkspaceEntry;
  id: string;
  label: string;
  path: readonly string[];
  folderIcons?: readonly CatalogFolderIcon[];
  packagePaths?: readonly (readonly string[])[];
  searchText: string;
};

export type CatalogFolderIcon = Pick<SourceWorkspaceFolderIcon, "name"> & {
  path: readonly string[];
};

const primitiveNames = new Set([
  "Badge",
  "Box",
  "Button",
  "Card",
  "Center",
  "Divider",
  "FileIcon",
  "Grid",
  "Heading",
  "Icon",
  "Scrollable",
  "Spacer",
  "Spinner",
  "Stack",
  "Text",
]);

export function sourceCatalogComponents(options: {
  appTargetId?: string;
  appWorkspace?: RuntimeSourceWorkspace;
  catalog?: RuntimeSourceLibraryCatalog;
  device: DesignSpaceDevice;
  kind: SourceCatalogKind;
  library?: SourceWorkspaceLibrary;
  mode: SourceLibraryMode;
}): readonly SourceCatalogComponent[] {
  if (options.kind === "app") {
    return sourceTreeNodes(options.appWorkspace ?? emptyWorkspace(), options.appTargetId).map((node) => {
      const entry = node.implementations[options.device].entry ?? node.entries[0];
      return {
        category: "app",
        entry,
        id: `app.${node.id}`,
        label: node.label,
        path: node.area === "components" ? replacePathLeaf(node.path ?? [node.label], node.label) : [node.label],
        folderIcons: entry ? catalogFolderIcons(options.appWorkspace, entry) : undefined,
        packagePaths: entry ? catalogPackagePaths(options.appWorkspace, entry) : undefined,
        searchText: `${node.label} ${(node.path ?? []).join(" ")} ${entry?.exportName ?? ""} ${entry?.relativePath ?? ""} ${node.area}`.toLocaleLowerCase(),
      };
    });
  }

  const source = selectedLibraryCatalog(options.catalog, options.mode);
  const exported = options.library?.components ?? [];
  const entries = sourceEntriesForComponents(
    source?.entries ?? [],
  );
  const designedSources = entries.filter((entry) => entry.design).map((entry) => ({ name: entry.label, entry }));
  const sources = options.mode === "development"
    ? developmentCatalogSources(entries, exported)
    : exported.length
      ? exported.map((component) => ({ name: component.name, evidence: component }))
      : designedSources;
  const occurrences = new Map<string, number>();

  return sources.map((sourceItem) => {
    const name = sourceItem.name;
    const occurrence = occurrences.get(name) ?? 0;
    occurrences.set(name, occurrence + 1);
    const entry = options.mode === "development"
      ? ("entry" in sourceItem ? sourceItem.entry : undefined)
      : entries.find((candidate) => candidate.label === name || candidate.exportName === name);
    const evidence = "evidence" in sourceItem ? sourceItem.evidence : undefined;
    const category = libraryCategory(name, entry, evidence?.category);
    return {
      category,
      entry,
      id: entry?.id ?? `library.${options.mode}.${name}.${occurrence}`,
      label: name,
      path: entry ? catalogComponentPath(options.catalog?.development, entry, name) : [name],
      folderIcons: entry && options.mode === "development"
        ? catalogFolderIcons(options.catalog?.development, entry)
        : undefined,
      packagePaths: entry && options.mode === "development"
        ? catalogPackagePaths(options.catalog?.development, entry)
        : undefined,
      searchText: `${name} ${entry?.exportName ?? ""} ${entry?.relativePath ?? ""} ${category} ${entry ? catalogComponentPath(options.catalog?.development, entry, name).join(" ") : ""}`.toLocaleLowerCase(),
    };
  }).sort((left, right) => left.label.localeCompare(right.label, "en") || left.path.join("/").localeCompare(right.path.join("/"), "en"));
}

function sourceEntriesForComponents(
  entries: readonly RuntimeSourceWorkspaceEntry[],
): readonly RuntimeSourceWorkspaceEntry[] {
  // Library package configs describe preview/layout roots, but they are not a
  // complete inventory of the package's exported source. The repository
  // index already contains compiler-discovered entries for every package;
  // keep that evidence intact and use package boundaries for grouping only.
  return entries;
}

function catalogFolderIcons(
  workspace: Pick<RuntimeSourceWorkspace, "folderIcons" | "packages"> | undefined,
  entry: Pick<RuntimeSourceWorkspaceEntry, "area" | "label" | "relativePath">,
): readonly CatalogFolderIcon[] | undefined {
  const entryPath = entry.relativePath.replaceAll("\\", "/");
  const icons = (workspace?.folderIcons ?? []).flatMap((icon) => {
    if (!entryPath.startsWith(`${icon.directory}/`)) return [];
    const path = catalogDirectoryPath(workspace, icon.directory);
    return path.length ? [{ name: icon.name, path }] : [];
  });
  return icons.length ? icons : undefined;
}

function catalogPackagePaths(
  workspace: Pick<RuntimeSourceWorkspace, "packageDirectories" | "packages"> | undefined,
  entry: Pick<RuntimeSourceWorkspaceEntry, "relativePath">,
): readonly (readonly string[])[] | undefined {
  const entryPath = entry.relativePath.replaceAll("\\", "/");
  if (workspace?.packages?.length) {
    const paths = workspace.packages
      .filter((pkg) => isPathWithin(entryPath, pkg.directory))
      .sort((left, right) => right.directory.length - left.directory.length)
      .slice(0, 1)
      .map((pkg) => physicalPackagePath(pkg.directory));
    return paths.length ? paths : undefined;
  }
  const paths = (workspace?.packageDirectories ?? []).flatMap((directory) => {
    if (!entryPath.startsWith(`${directory}/`)) return [];
    const path = physicalPackagePath(directory);
    return path.length ? [path] : [];
  });
  return paths.length ? paths : undefined;
}

function catalogComponentPath(
  workspace: Pick<RuntimeSourceWorkspace, "packages" | "componentRoot" | "componentRoots"> | undefined,
  entry: Pick<RuntimeSourceWorkspaceEntry, "area" | "label" | "relativePath">,
  label: string,
): readonly string[] {
  const configuredRoot = (workspace?.componentRoots ?? [])
    .filter((root) => isPathWithin(entry.relativePath, root))
    .sort((left, right) => right.length - left.length)[0];
  if (configuredRoot) {
    const componentPath = componentPathFromRoot(entry.relativePath, configuredRoot, label);
    const pkg = catalogPackageForEntry(workspace, entry.relativePath);
    return pkg ? [...physicalPackagePath(pkg.directory), ...componentPath] : componentPath;
  }
  const sourcePath = replacePathLeaf(sourceEntryComponentPath(entry), label);
  const pkg = catalogPackageForEntry(workspace, entry.relativePath);
  if (!pkg) {
    const root = workspace?.componentRoot?.replace(/^\.\//, "");
    if (root && isPathWithin(entry.relativePath, root)) {
      const rootSegments = root.split("/").filter(Boolean);
      const relativePath = sourcePath.slice(rootSegments.length);
      return relativePath.length ? relativePath : [label];
    }
    return sourcePath;
  }
  const packagePath = physicalPackagePath(pkg.directory);
  const packageRelative = stripPackageSourcePrefix(
    normalizeCatalogSourcePath(replacePathLeaf(sourceEntryComponentPath(entry), label)),
    packagePath,
  );
  return [...packagePath, ...packageRelative];
}

function componentPathFromRoot(relativePath: string, root: string, label: string): readonly string[] {
  const remainder = relativePath.slice(root.length).replace(/^\//, "");
  const segments = remainder.split("/").filter(Boolean);
  const filename = segments.pop() ?? label;
  const stem = filename.replace(/\.[cm]?[jt]sx?$/i, "");
  if (/^(?:render|index|desktop|tablet|mobile)$/i.test(stem)) return segments.length ? segments : [label];
  const componentStem = stem.replace(/[.-](?:desktop|tablet|mobile)$/i, "");
  return [...segments, componentStem || label];
}

function catalogPackageForEntry(
  workspace: Pick<RuntimeSourceWorkspace, "packages"> | undefined,
  entryPath: string,
): SourceWorkspacePackage | undefined {
  return (workspace?.packages ?? [])
    .filter((pkg) => isPathWithin(entryPath, pkg.directory))
    .sort((left, right) => right.directory.length - left.directory.length)[0];
}

function catalogDirectoryPath(
  workspace: Pick<RuntimeSourceWorkspace, "packages"> | undefined,
  directory: string,
): readonly string[] {
  const pkg = catalogPackageForEntry(workspace, `${directory}/placeholder.tsx`);
  if (pkg) {
    const packagePath = physicalPackagePath(pkg.directory);
    if (pkg.directory === ".") return sourceDirectoryPath(directory);
    const relativeDirectory = relativeEntryPath(directory, pkg.directory);
    return [...packagePath, ...sourceDirectoryPath(relativeDirectory)];
  }
  return physicalPackagePath(directory);
}

function physicalPackagePath(directory: string): readonly string[] {
  const segments = directory === "." ? [] : directory.split("/").filter(Boolean);
  const rootIndex = segments.findIndex((segment) => {
    const normalized = segment.toLocaleLowerCase();
    return normalized === "components" || normalized === "primitives";
  });
  return rootIndex < 0 ? [] : segments.slice(rootIndex + 1);
}

function relativeEntryPath(path: string, packageDirectory: string): string {
  const normalizedPath = path.replaceAll("\\", "/");
  if (packageDirectory === ".") return normalizedPath;
  if (normalizedPath === packageDirectory) return "";
  return normalizedPath.startsWith(`${packageDirectory}/`)
    ? normalizedPath.slice(packageDirectory.length + 1)
    : normalizedPath;
}

function stripPackageSourcePrefix(
  sourcePath: readonly string[],
  packagePath: readonly string[],
): readonly string[] {
  let remainder = startsWithPath(sourcePath, packagePath) ? sourcePath.slice(packagePath.length) : sourcePath;
  if (remainder[0]?.toLocaleLowerCase() === "src") remainder = remainder.slice(1);
  if (remainder[0]?.toLocaleLowerCase() === "components" || remainder[0]?.toLocaleLowerCase() === "primitives") {
    remainder = remainder.slice(1);
  }
  return remainder;
}

function sourceDirectoryPath(directory: string): readonly string[] {
  const segments = directory === "." ? [] : directory.split("/").filter(Boolean);
  const rootIndex = segments.findIndex((segment) => {
    const normalized = segment.toLocaleLowerCase();
    return normalized === "components" || normalized === "primitives";
  });
  return rootIndex < 0 ? [] : segments.slice(rootIndex + 1);
}

function startsWithPath(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment);
}

function isPathWithin(path: string, directory: string): boolean {
  return directory === "." || path === directory || path.startsWith(`${directory}/`);
}

function replacePathLeaf(path: readonly string[], label: string): readonly string[] {
  if (path.length <= 1) return [label];
  const parentPath = path.slice(0, -1);
  return parentPath.at(-1)?.toLocaleLowerCase() === label.toLocaleLowerCase()
    ? parentPath
    : [...parentPath, label];
}

export function filterSourceCatalog(
  components: readonly SourceCatalogComponent[],
  query: string,
  category: SourceLibraryCategory,
): readonly SourceCatalogComponent[] {
  const normalized = query.trim().toLocaleLowerCase();
  return components.filter((component) => (
    (!normalized || component.searchText.includes(normalized))
    && (category === "all" || component.category === category)
  ));
}

export function selectedSourceCatalogComponent(
  components: readonly SourceCatalogComponent[],
  selected: string | undefined,
): SourceCatalogComponent | undefined {
  return components.find((component) => component.id === selected) ?? components[0];
}

function selectedLibraryCatalog(
  catalog: RuntimeSourceLibraryCatalog | undefined,
  mode: SourceLibraryMode,
) {
  return mode === "development" ? catalog?.development : catalog?.release;
}

function developmentCatalogSources(
  entries: readonly RuntimeSourceWorkspaceEntry[],
  exported: SourceWorkspaceLibrary["components"],
) {
  const sources = new Map<string, {
    name: string;
    entry: RuntimeSourceWorkspaceEntry;
    evidence?: SourceWorkspaceLibrary["components"][number];
  }>();
  const occurrences = new Map<string, number>();
  for (const evidence of exported) {
    const occurrence = occurrences.get(evidence.name) ?? 0;
    occurrences.set(evidence.name, occurrence + 1);
    const entry = developmentEntry(entries, evidence.name, occurrence);
    if (entry) {
      const key = developmentEntryKey(entry);
      if (!sources.has(key)) sources.set(key, { name: evidence.name, entry, evidence });
    }
  }
  const grouped = new Map<string, RuntimeSourceWorkspaceEntry[]>();
  for (const entry of entries) {
    const key = developmentEntryKey(entry);
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  for (const [key, candidates] of grouped) {
    if (!sources.has(key)) {
      const entry = candidates.find((candidate) => candidate.design) ?? candidates.find((candidate) => candidate.device === "desktop") ?? candidates[0]!;
      sources.set(key, { name: entry.label, entry });
    }
  }
  return [...sources.values()];
}

function developmentEntryKey(entry: RuntimeSourceWorkspaceEntry): string {
  const segments = entry.relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
  const filename = segments.pop()?.replace(/\.[cm]?[jt]sx?$/i, "") ?? entry.label;
  if (!/^(?:render|index|desktop|tablet|mobile)$/i.test(filename)) segments.push(filename);
  if (segments.at(-1)?.toLocaleLowerCase() === entry.label.toLocaleLowerCase()) segments.pop();
  return `${segments.join("/")}\0${entry.exportName}`;
}

function normalizeCatalogSourcePath(path: readonly string[]): readonly string[] {
  const last = path.at(-1)?.toLocaleLowerCase();
  return last && /^(?:render|index|desktop|tablet|mobile)$/.test(last) ? path.slice(0, -1) : path;
}

function developmentEntry(entries: readonly RuntimeSourceWorkspaceEntry[], name: string, occurrence = 0) {
  const exact = entries.filter((entry) => entry.exportName === name || entry.label === name);
  const exactDesign = exact.filter((entry) => entry.design)[occurrence];
  if (exactDesign) return exactDesign;
  if (name.startsWith("Primitive")) {
    const primitiveName = name.slice("Primitive".length);
    const primitive = entries.find((entry) => (
      entry.label === primitiveName
      && entry.relativePath.includes("/primitives/")
    ));
    if (primitive) return primitive;
  }
  return exact[occurrence] ?? exact[0];
}

function libraryCategory(
  name: string,
  entry: RuntimeSourceWorkspaceEntry | undefined,
  evidence: SourceWorkspaceLibrary["components"][number]["category"],
): "primitive" | "composed" {
  if (evidence) return evidence === "primitive" ? "primitive" : "composed";
  if (entry?.relativePath.includes("/primitives/")) return "primitive";
  return primitiveNames.has(name.replace(/^Primitive/, "")) ? "primitive" : "composed";
}

function emptyWorkspace(): RuntimeSourceWorkspace {
  return {
    devices: [],
    entries: [],
    runtime: "react",
    sourceRoot: "src",
    styles: [],
  };
}
