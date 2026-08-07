import type { SourceCatalogComponent } from "./source-library-catalog";

export type SourceCatalogTreeItem = SourceCatalogFolder | SourceCatalogLeaf;

export interface SourceCatalogFolder {
  children: readonly SourceCatalogTreeItem[];
  id: string;
  kind: "folder";
  label: string;
  iconName?: string;
  isPackage?: boolean;
  path: readonly string[];
}

export interface SourceCatalogLeaf {
  component: SourceCatalogComponent;
  kind: "component";
}

interface MutableCatalogFolder {
  children: Map<string, MutableCatalogFolder>;
  components: SourceCatalogComponent[];
  label: string;
  iconConflict?: true;
  iconName?: string;
  packagePath?: readonly string[];
  path: readonly string[];
}

export function sourceCatalogTree(
  components: readonly SourceCatalogComponent[],
): readonly SourceCatalogTreeItem[] {
  const scope = [...new Set(components.map((component) => component.category))].join("+") || "catalog";
  const root: MutableCatalogFolder = { children: new Map(), components: [], label: "", path: [] };
  for (const component of components) {
    const path = component.path.length ? component.path : [component.label];
    let folder = root;
    for (const segment of path) {
      const nextPath = [...folder.path, segment];
      const child: MutableCatalogFolder = folder.children.get(segment) ?? {
        children: new Map(),
        components: [],
        label: segment,
        path: nextPath,
      };
      folder.children.set(segment, child);
      const iconName = component.folderIcons?.find((icon) => pathsEqual(icon.path, nextPath))?.name;
      const packagePath = component.packagePaths?.find((packagePath) => pathsEqual(packagePath, nextPath));
      if (iconName && child.iconName && child.iconName !== iconName) {
        child.iconConflict = true;
        child.iconName = undefined;
      } else if (iconName && !child.iconConflict) {
        child.iconName = iconName;
      }
      if (packagePath) child.packagePath = packagePath;
      folder = child;
    }
    folder.components.push(component);
  }
  return catalogChildren(root, scope);
}

function catalogChildren(folder: MutableCatalogFolder, scope: string): readonly SourceCatalogTreeItem[] {
  const items: SourceCatalogTreeItem[] = folder.components.map((component) => ({
    component,
    kind: "component",
  }));
  for (const child of folder.children.values()) {
    const children = catalogChildren(child, scope);
    if (child.children.size === 0 && child.packagePath === undefined && child.iconName === undefined) {
      items.push(...children);
      continue;
    }
    items.push({
      children,
      id: `folder:${scope}:${child.path.join("/")}`,
      kind: "folder",
      label: child.label,
      iconName: child.iconName,
      isPackage: child.packagePath !== undefined,
      path: child.path,
    });
  }
  return items.sort(compareCatalogItems);
}

function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function compareCatalogItems(left: SourceCatalogTreeItem, right: SourceCatalogTreeItem): number {
  const label = left.kind === "folder" ? left.label : left.component.label;
  const otherLabel = right.kind === "folder" ? right.label : right.component.label;
  return label.localeCompare(otherLabel, "en") || (left.kind === "folder" ? -1 : 1);
}
