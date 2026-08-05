
import { Button } from "@heroui/react";
import { ChevronRight, Diamond } from "lucide-react";
import type { SourceCanvasNavigationNode } from "./source-canvas-ancestry";

export function SourceCanvasNavigationBranch(props: {
  currentId?: string;
  depth: number;
  expandedIds: ReadonlySet<string>;
  node: SourceCanvasNavigationNode;
  pathIds: ReadonlySet<string>;
  onSelect: (node: SourceCanvasNavigationNode) => void;
  onToggle: (node: SourceCanvasNavigationNode) => void;
}) {
  const current = props.node.id === props.currentId;
  const onPath = props.pathIds.has(props.node.id);
  const expandable = props.node.children.length > 0;
  const expanded = expandable && props.expandedIds.has(props.node.id);
  return (
    <div role="none">
      <div
        className={`flex h-7 w-max min-w-full items-center rounded-lg pr-2 ${
          current
            ? "bg-fuchsia-400/16 text-fuchsia-200"
            : onPath
              ? "bg-fuchsia-400/[0.06] text-fuchsia-300"
              : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
        }`}
        style={{ paddingLeft: `${4 + props.depth * 14}px` }}
      >
        {expandable ? (
          <Button
            isIconOnly
            aria-label={`${expanded ? "Collapse" : "Expand"} ${props.node.label}`}
            aria-pressed={expanded}
            className="size-5 min-w-5 shrink-0 rounded-md text-current hover:bg-white/[0.06]"
            size="sm"
            variant="ghost"
            onPress={() => props.onToggle(props.node)}
          >
            <ChevronRight aria-hidden="true" className={`transition-transform ${expanded ? "rotate-90" : ""}`} size={10} />
          </Button>
        ) : <span aria-hidden="true" className="w-5 shrink-0" />}
        <button
          aria-current={current ? "location" : undefined}
          aria-expanded={expandable ? expanded : undefined}
          aria-level={props.depth + 1}
          className={`flex h-7 min-w-max flex-1 items-center gap-2 whitespace-nowrap text-[10px] ${current ? "font-medium" : ""}`}
          data-slot-label={props.node.slotLabel}
          role="treeitem"
          type="button"
          onClick={() => props.onSelect(props.node)}
        >
          <Diamond
            aria-hidden="true"
            className={`size-3 shrink-0 ${onPath ? "text-fuchsia-300" : "text-zinc-600"}`}
            data-testid="source-canvas-tree-component-icon"
            strokeWidth={1.8}
          />
          <span className="text-left">{props.node.label}</span>
        </button>
      </div>
      {expanded ? props.node.children.map((child) => (
        <SourceCanvasNavigationBranch
          currentId={props.currentId}
          depth={props.depth + 1}
          expandedIds={props.expandedIds}
          key={child.id}
          node={child}
          pathIds={props.pathIds}
          onSelect={props.onSelect}
          onToggle={props.onToggle}
        />
      )) : null}
    </div>
  );
}
