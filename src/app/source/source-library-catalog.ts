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
  const entries = source?.entries ?? [];
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
      .map((pkg) => [pkg.name]);
    return paths.length ? paths : undefined;
  }
  const paths = (workspace?.packageDirectories ?? []).flatMap((directory) => {
    if (!entryPath.startsWith(`${directory}/`)) return [];
    const segments = directory.split("/").filter(Boolean);
    const rootIndex = segments.findIndex((segment) => {
      const normalized = segment.toLocaleLowerCase();
      return normalized === "components" || normalized === "primitives";
    });
    const path = rootIndex < 0 ? [] : segments.slice(rootIndex + 1);
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
    return pkg ? [pkg.name, ...componentPath] : componentPath;
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
  const prefix = sourceDirectoryPath(pkg.directory);
  const remainder = prefix.length && startsWithPath(sourcePath, prefix)
    ? sourcePath.slice(prefix.length)
    : sourcePath;
  return [pkg.name, ...remainder];
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
    if (pkg.directory === ".") return [pkg.name, ...sourceDirectoryPath(directory)];
    const segments = directory.split("/").filter(Boolean);
    const packageSegments = pkg.directory === "." ? [] : pkg.directory.split("/").filter(Boolean);
    const remainder = segments.slice(packageSegments.length);
    return [pkg.name, ...remainder];
  }
  const segments = directory.split("/").filter(Boolean);
  const rootIndex = segments.findIndex((segment) => {
    const normalized = segment.toLocaleLowerCase();
    return normalized === "components" || normalized === "primitives";
  });
  return rootIndex < 0 ? [] : segments.slice(rootIndex + 1);
}

function sourceDirectoryPath(directory: string): readonly string[] {
  const segments = directory === "." ? [] : directory.split("/").filter(Boolean);
  const rootIndex = segments.findIndex((segment) => {
    const normalized = segment.toLocaleLowerCase();
    return normalized === "components" || normalized === "primitives";
  });
  return rootIndex < 0 ? [] : segments.slice(rootIndex + 1);
}

function isPathWithin(path: string, directory: string): boolean {
  return directory === "." || path === directory || path.startsWith(`${directory}/`);
}

function startsWithPath(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment);
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
    if (entry) sources.set(entry.id, { name: evidence.name, entry, evidence });
  }
  for (const entry of entries) {
    if (entry.design && !sources.has(entry.id)) sources.set(entry.id, { name: entry.label, entry });
  }
  return [...sources.values()];
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
