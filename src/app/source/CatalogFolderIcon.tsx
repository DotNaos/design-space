import { lazy, Suspense, type ComponentType } from "react";
import { Folder, type LucideProps } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

const folderIconComponents = new Map<string, ComponentType<LucideProps>>();
const defaultFolderIcon = <Folder aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />;

export function CatalogFolderIcon(props: { name?: string }) {
  const importer = props.name
    ? dynamicIconImports[props.name as keyof typeof dynamicIconImports]
    : undefined;
  if (!props.name || !importer) return defaultFolderIcon;

  let Icon = folderIconComponents.get(props.name);
  if (!Icon) {
    Icon = lazy(importer) as ComponentType<LucideProps>;
    folderIconComponents.set(props.name, Icon);
  }
  return (
    <Suspense fallback={defaultFolderIcon}>
      <Icon aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />
    </Suspense>
  );
}
