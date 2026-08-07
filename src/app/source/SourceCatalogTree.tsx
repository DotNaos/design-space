import { Button } from "@heroui/react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { CatalogComponentRow } from "./CatalogComponentRow";
import type { SourceCatalogTreeItem } from "./source-catalog-tree";

export function SourceCatalogTree(props: {
  collapsed: ReadonlySet<string>;
  items: readonly SourceCatalogTreeItem[];
  selected?: string;
  source?: { entries: readonly RuntimeSourceWorkspaceEntry[] };
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return props.items.map((item) => item.kind === "component" ? (
    <CatalogComponentRow
      component={item.component}
      key={item.component.id}
      selected={props.selected === item.component.id}
      source={props.source}
      onSelect={props.onSelect}
    />
  ) : (
    <CatalogFolderBranch key={item.id} {...props} depth={0} item={item} />
  ));
}

function CatalogFolderBranch(props: Parameters<typeof SourceCatalogTree>[0] & {
  depth: number;
  item: Extract<SourceCatalogTreeItem, { kind: "folder" }>;
}) {
  const collapsed = props.collapsed.has(props.item.id);
  return (
    <div aria-label={props.item.path.join(" / ")} role="group">
      <div className="mx-2.5 flex min-h-9 items-center" role="listitem" style={{ paddingLeft: props.depth * 14 }}>
        <Button
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} folder ${props.item.path.join(" / ")}`}
          className="relative min-h-8 min-w-0 flex-1 justify-start gap-1.5 rounded-lg px-3.5 text-left text-xs font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
          fullWidth
          variant="ghost"
          onPress={() => props.onToggle(props.item.id)}
        >
          {collapsed
            ? <ChevronRight aria-hidden="true" className="absolute -start-0.5 size-3" />
            : <ChevronDown aria-hidden="true" className="absolute -start-0.5 size-3" />}
          <Folder aria-hidden="true" className="text-zinc-500" size={13} />
          <span className="whitespace-nowrap">{props.item.label}</span>
        </Button>
      </div>
      {!collapsed ? props.item.children.map((child) => child.kind === "component" ? (
        <CatalogComponentRow
          component={child.component}
          depth={props.depth + 1}
          key={child.component.id}
          selected={props.selected === child.component.id}
          source={props.source}
          onSelect={props.onSelect}
        />
      ) : (
        <CatalogFolderBranch key={child.id} {...props} depth={props.depth + 1} item={child} />
      )) : null}
    </div>
  );
}
