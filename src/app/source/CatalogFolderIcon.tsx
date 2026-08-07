import { lazy, Suspense, type ComponentType } from "react";
import { Folder, type LucideProps } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { NpmBrandIcon } from "./NpmBrandIcon";

const folderIconComponents = new Map<string, ComponentType<LucideProps>>();
const defaultFolderIcon = <Folder aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />;

export function CatalogFolderIcon(props: { name?: string; isPackage?: boolean }) {
  const importer = props.name
    ? dynamicIconImports[props.name as keyof typeof dynamicIconImports]
    : undefined;
  let Icon = props.name && importer ? folderIconComponents.get(props.name) : undefined;
  if (props.name && importer && !Icon) {
    Icon = lazy(importer) as ComponentType<LucideProps>;
    folderIconComponents.set(props.name, Icon);
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {Icon ? (
        <Suspense fallback={defaultFolderIcon}>
          <Icon aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />
        </Suspense>
      ) : defaultFolderIcon}
      {props.isPackage ? <NpmBrandIcon /> : null}
    </span>
  );
}
