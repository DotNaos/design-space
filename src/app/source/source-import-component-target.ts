import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";

export interface SourceImportedComponentTarget {
  entry: SourceWorkspaceEntry;
  layerId: string;
}

export function sourceImportedComponentTarget(input: {
  currentEntry?: SourceWorkspaceEntry;
  entries: readonly SourceWorkspaceEntry[];
  layer?: SourceWorkspaceLayer;
  source: string;
}): SourceImportedComponentTarget | undefined {
  const { currentEntry, entries, layer, source } = input;
  if (!currentEntry || layer?.kind !== "component" || !source) return undefined;

  const imported = importedComponent(source, layer.label);
  if (!imported) return undefined;

  const modulePath = resolveModulePath(currentEntry.relativePath, imported.moduleSpecifier);
  const exactCandidates = entries.filter((entry) => sameModule(entry.relativePath, modulePath));
  const directoryCandidates = entries.filter((entry) => (
    entry.relativePath.startsWith(`${modulePath}/`)
    && entry.exportName === imported.importedName
  ));
  const globalCandidates = entries.filter((entry) => entry.exportName === imported.importedName);
  const target = exactCandidates.find((entry) => (
    imported.importedName === "default" || entry.exportName === imported.importedName
  ))
    ?? directoryCandidates[0]
    ?? (globalCandidates.length === 1 ? globalCandidates[0] : undefined);
  const layerId = target?.layers?.[0]?.id;
  if (!target || target.id === currentEntry.id || !layerId) return undefined;

  return { entry: target, layerId };
}

function importedComponent(source: string, localName: string): {
  importedName: string;
  moduleSpecifier: string;
} | undefined {
  const namedImportPattern = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  for (const match of source.matchAll(namedImportPattern)) {
    const moduleSpecifier = match[2];
    if (!moduleSpecifier) continue;
    for (const rawBinding of (match[1] ?? "").split(",")) {
      const binding = rawBinding.trim().replace(/^type\s+/, "");
      const bindingMatch = binding.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (!bindingMatch) continue;
      const importedName = bindingMatch[1];
      const localBinding = bindingMatch[2] ?? importedName;
      if (localBinding === localName && importedName) return { importedName, moduleSpecifier };
    }
  }

  const defaultImportPattern = /import\s+([\w$]+)\s+from\s+["']([^"']+)["']/g;
  for (const match of source.matchAll(defaultImportPattern)) {
    if (match[1] === localName && match[2]) {
      return { importedName: "default", moduleSpecifier: match[2] };
    }
  }
  return undefined;
}

function resolveModulePath(currentRelativePath: string, moduleSpecifier: string): string {
  if (!moduleSpecifier.startsWith(".")) return stripExtension(moduleSpecifier);
  const segments = currentRelativePath.split("/").slice(0, -1);
  for (const segment of moduleSpecifier.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return stripExtension(segments.join("/"));
}

function sameModule(relativePath: string, modulePath: string): boolean {
  const normalized = stripExtension(relativePath);
  return normalized === modulePath || normalized === `${modulePath}/index`;
}

function stripExtension(value: string): string {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/, "");
}
