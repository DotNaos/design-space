import type {
  DesignSpaceDevice,
  RuntimeSourceLibraryCatalog,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceFolderIcon,
  SourceWorkspaceLibrary,
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
        searchText: `${node.label} ${(node.path ?? []).join(" ")} ${entry?.exportName ?? ""} ${entry?.relativePath ?? ""} ${node.area}`.toLocaleLowerCase(),
      };
    });
  }

  const source = selectedLibraryCatalog(options.catalog, options.mode);
  const exported = options.library?.components ?? [];
  const entries = source?.entries ?? [];
  const names = exported.length
    ? exported.map((component) => component.name)
    : [...new Set(entries.map((entry) => entry.label))];

  return names.map((name) => {
    const entry = options.mode === "development"
      ? developmentEntry(entries, name)
      : entries.find((candidate) => candidate.label === name || candidate.exportName === name);
    const evidence = exported.find((component) => component.name === name);
    const category = libraryCategory(name, entry, evidence?.category);
    return {
      category,
      entry,
      id: entry?.id ?? `library.${options.mode}.${name}`,
      label: name,
      path: entry ? replacePathLeaf(sourceEntryComponentPath(entry), name) : [name],
      folderIcons: entry && options.mode === "development"
        ? catalogFolderIcons(options.catalog?.development, entry)
        : undefined,
      searchText: `${name} ${entry?.exportName ?? ""} ${entry?.relativePath ?? ""} ${category}`.toLocaleLowerCase(),
    };
  }).sort((left, right) => left.label.localeCompare(right.label, "en"));
}

function catalogFolderIcons(
  workspace: Pick<RuntimeSourceWorkspace, "folderIcons"> | undefined,
  entry: Pick<RuntimeSourceWorkspaceEntry, "relativePath">,
): readonly CatalogFolderIcon[] | undefined {
  const entryPath = entry.relativePath.replaceAll("\\", "/");
  const icons = (workspace?.folderIcons ?? []).flatMap((icon) => {
    if (!entryPath.startsWith(`${icon.directory}/`)) return [];
    const segments = icon.directory.split("/").filter(Boolean);
    const rootIndex = segments.findIndex((segment) => {
      const normalized = segment.toLocaleLowerCase();
      return normalized === "components" || normalized === "primitives";
    });
    const path = rootIndex < 0 ? [] : segments.slice(rootIndex + 1);
    return path.length ? [{ name: icon.name, path }] : [];
  });
  return icons.length ? icons : undefined;
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

function developmentEntry(entries: readonly RuntimeSourceWorkspaceEntry[], name: string) {
  const exact = entries.filter((entry) => entry.exportName === name || entry.label === name);
  const exactDesign = exact.find((entry) => entry.design);
  if (exactDesign) return exactDesign;
  if (name.startsWith("Primitive")) {
    const primitiveName = name.slice("Primitive".length);
    const primitive = entries.find((entry) => (
      entry.design
      && entry.label === primitiveName
      && entry.relativePath.includes("/primitives/")
    ));
    if (primitive) return primitive;
  }
  return exact[0];
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
