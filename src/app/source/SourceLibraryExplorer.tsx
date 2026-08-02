import { Layers3 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourceWorkspaceCodeOverlay } from "./SourceWorkspaceCodeOverlay";
import {
  selectedCatalogWorkspace,
  selectedSourceLibraryComponent,
  SourceLibrarySidebar,
  type SourceLibraryProps,
} from "./SourceLibraryWorkspace";
import { initialFocusOccurrence, sourceFocusGraph } from "./source-focus-tree";
import { sourceCatalogComponents } from "./source-library-catalog";
import { findSourceTreeLayer, sourceTreeNodes } from "./source-workspace-tree";
import {
  SourceWorkspaceTree,
  type SourceWorkspaceSelection,
} from "./SourceWorkspaceSidebar";

export interface SourceLibraryExplorerProps extends SourceLibraryProps {
  code: ReactNode;
  codeHeight?: number;
  codeOpen: boolean;
  onCodeHeightChange?: (height: number | undefined) => void;
  onCodeOpenChange: (open: boolean) => void;
  onSelect: (componentId: string) => void;
}

export function SourceLibraryExplorer(props: SourceLibraryExplorerProps) {
  const workspace = selectedCatalogWorkspace(props);
  const component = selectedSourceLibraryComponent(props);
  const nodes = useMemo(() => sourceTreeNodes(workspace ?? emptyWorkspace()), [workspace]);
  const rootNode = useMemo(() => selectedComponentNode(nodes, component?.entry), [component?.entry, nodes]);
  const graph = useMemo(
    () => sourceFocusGraph(nodes, props.device, rootNode ? [rootNode.id] : undefined),
    [nodes, props.device, rootNode],
  );
  const rootOccurrenceId = initialFocusOccurrence(graph);
  const selectedLayer = findSourceTreeLayer(component?.entry?.layers, props.selectedLayer?.id);
  const selected = rootNode ? {
    device: props.device,
    kind: selectedLayer?.kind ?? "component",
    layerId: selectedLayer?.id,
    nodeId: rootNode.id,
    occurrenceId: rootOccurrenceId,
    sourceNodeId: rootNode.id,
  } satisfies SourceWorkspaceSelection : undefined;

  const openComponent = (occurrenceId: string) => {
    const occurrence = graph.occurrences.get(occurrenceId);
    const entryId = occurrence?.entry?.id;
    if (!entryId) return;
    const next = sourceCatalogComponents({
      appWorkspace: props.appWorkspace,
      catalog: props.catalog,
      device: props.device,
      kind: props.catalogKind,
      library: props.library,
      mode: props.mode,
    }).find((candidate) => candidate.entry?.id === entryId);
    if (!next) return;
    props.onSelect(next.id);
    props.onSelectLayer?.(undefined);
  };

  const details = workspace && rootNode ? (
    <section aria-label="Selected component layers" className="flex h-full min-h-0 flex-col bg-[#141518]">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <Layers3 aria-hidden="true" className="text-violet-400" size={13} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-zinc-300">
          {component?.label ?? "Layers"}
        </span>
        <span className="text-[8px] text-zinc-700">Layers</span>
      </header>
      <div className="min-h-0 flex-1">
        <SourceWorkspaceTree
          emptyMessage="No layers were found for this component."
          expandFocus
          focusId={rootOccurrenceId}
          focusNodeId={rootNode.id}
          rootNodeIds={[rootNode.id]}
          selected={selected}
          treeStateKey={`${props.treeStateKey ?? "library"}:${rootNode.id}`}
          workspace={workspace}
          onFocus={(occurrenceId) => openComponent(occurrenceId)}
          onHover={() => undefined}
          onSelect={(next) => props.onSelectLayer?.(next.layerId)}
        />
      </div>
    </section>
  ) : (
    <div className="grid h-full place-items-center px-5 text-center text-[10px] leading-4 text-zinc-600">
      Select a component with registered source to inspect its layers.
    </div>
  );

  return (
    <SourceWorkspaceCodeOverlay
      code={props.code}
      height={props.codeHeight}
      open={props.codeOpen}
      onHeightChange={props.onCodeHeightChange}
      onOpenChange={props.onCodeOpenChange}
    >
      <SourceLibrarySidebar {...props} details={details} />
    </SourceWorkspaceCodeOverlay>
  );
}

function selectedComponentNode(
  nodes: ReturnType<typeof sourceTreeNodes>,
  entry: RuntimeSourceWorkspaceEntry | undefined,
) {
  if (!entry) return undefined;
  return nodes.find((node) => node.entries.some((candidate) => candidate.id === entry.id));
}

function emptyWorkspace() {
  return {
    devices: [],
    entries: [],
    runtime: "react" as const,
    sourceRoot: "src",
    styles: [],
  };
}
