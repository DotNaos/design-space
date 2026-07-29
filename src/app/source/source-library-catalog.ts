import type {
  DesignSpaceDevice,
  RuntimeSourceLibraryCatalog,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLibrary,
} from "../../shared/source-workspace";
import { sourceTreeNodes } from "./source-workspace-tree";
import type { SourceLibraryMode } from "./useSourceLibraryRuntime";

export type SourceCatalogKind = "app" | "library";
export type SourceLibraryCategory = "all" | "primitive" | "composed";

export type SourceCatalogComponent = {
  category: Exclude<SourceLibraryCategory, "all"> | "app";
  entry?: RuntimeSourceWorkspaceEntry;
  id: string;
  label: string;
  searchText: string;
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
  appWorkspace?: RuntimeSourceWorkspace;
  catalog?: RuntimeSourceLibraryCatalog;
  device: DesignSpaceDevice;
  kind: SourceCatalogKind;
  library?: SourceWorkspaceLibrary;
  mode: SourceLibraryMode;
}): readonly SourceCatalogComponent[] {
  if (options.kind === "app") {
    return sourceTreeNodes(options.appWorkspace ?? emptyWorkspace()).map((node) => {
      const entry = node.implementations[options.device].entry ?? node.entries[0];
      return {
        category: "app",
        entry,
        id: `app.${node.id}`,
        label: node.label,
        searchText: `${node.label} ${entry?.exportName ?? ""} ${entry?.relativePath ?? ""} ${node.area}`.toLocaleLowerCase(),
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
      searchText: `${name} ${entry?.exportName ?? ""} ${entry?.relativePath ?? ""} ${category}`.toLocaleLowerCase(),
    };
  }).sort((left, right) => left.label.localeCompare(right.label, "en"));
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
