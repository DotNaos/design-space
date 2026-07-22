import { Button } from "@heroui/react";
import { Diamond, Library, LockKeyhole, PackageCheck, Radio } from "lucide-react";
import { useMemo } from "react";

import type {
  DesignSpaceDevice,
  RuntimeSourceLibraryCatalog,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLibrary,
} from "../../shared/source-workspace";
import { suggestedSourceDesignPath } from "../../shared/source-design";
import { SourceDesignStatus } from "./SourceDesignStatus";
import { SourcePreviewFrame } from "./SourcePreviewFrame";
import { sourceCanvasSelection } from "./source-canvas-selection";
import { sourceFocusGraph } from "./source-focus-tree";
import { SourceWorkspaceTree, type SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";
import { sourceTreeNodes, type SourceTreeNode } from "./source-workspace-tree";
import type { SourceLibraryMode } from "./useSourceLibraryRuntime";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source-layer-design";

interface SourceLibraryProps {
  catalog?: RuntimeSourceLibraryCatalog;
  device: DesignSpaceDevice;
  library?: SourceWorkspaceLibrary;
  mode: SourceLibraryMode;
  selected?: string;
  selectedLayer?: import("../../shared/source-workspace").SourceWorkspaceLayer;
  selectedClassName?: string;
  selectedClassCss?: string;
  selectedText?: string;
  selectionMode?: boolean;
  previewMode?: SourcePreviewMode;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onModeChange: (mode: SourceLibraryMode) => void;
  onSelectLayer?: (layerId: string | undefined) => void;
  onPreviewModeChange?: (mode: SourcePreviewMode) => void;
  onSelectedLayerMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
  generateDesignError?: string;
  generatingDesignEntryId?: string;
  onGenerateDesign?: (entry: RuntimeSourceWorkspaceEntry) => void;
}

export function SourceLibrarySidebar(props: SourceLibraryProps & { onSelect: (name: string) => void }) {
  const components = useMemo(() => libraryComponents(props), [props.catalog, props.library, props.mode]);
  const selected = resolvedSelectedLibraryComponentId(props);
  const ready = components.filter((component) => component.entry?.design).length;
  const source = selectedLibraryWorkspace(props);
  const nodes = useMemo(() => source ? sourceTreeNodes(source) : [], [source]);
  const roots = useMemo(() => libraryRootNodes(components, nodes), [components, nodes]);
  const rootNodeIds = useMemo(() => roots.map(({ node }) => node.id), [roots]);
  const rootLabels = useMemo(
    () => Object.fromEntries(roots.map(({ component, node }) => [node.id, component.label])),
    [roots],
  );
  const resolvedRootIds = useMemo(() => new Set(roots.map(({ component }) => component.id)), [roots]);
  const unresolvedRoots = useMemo(
    () => components.filter((component) => !resolvedRootIds.has(component.id)),
    [components, resolvedRootIds],
  );
  const focusNodeId = roots.find(({ component }) => component.id === selected)?.node.id;
  const graph = useMemo(
    () => sourceFocusGraph(nodes, props.device, rootNodeIds),
    [nodes, props.device, rootNodeIds],
  );
  const focusId = graph.roots.find((id) => graph.occurrences.get(id)?.node.id === focusNodeId);
  const treeSelection = props.selectedLayer
    ? sourceCanvasSelection(graph, focusId, props.selectedLayer.id, props.device)
    : undefined;
  const selectRoot = (node: SourceTreeNode) => {
    const root = roots.find((candidate) => candidate.node.id === node.id);
    if (!root) return;
    props.onSelect(root.component.id);
  };
  const selectTree = (selection: SourceWorkspaceSelection) => {
    const occurrence = selection.occurrenceId ? graph.occurrences.get(selection.occurrenceId) : undefined;
    if (!occurrence) return;
    if (!occurrence.parentId && selection.kind === "component" && !selection.layerId) {
      selectRoot(occurrence.node);
      return;
    }
    if (selection.layerId) props.onSelectLayer?.(selection.layerId);
  };
  return (
    <aside aria-label="Component library catalog" className="flex h-full min-h-0 w-full flex-col bg-[#141518]">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2"><Library className="text-sky-400" size={15} /><h2 className="text-sm font-semibold text-zinc-100">Component Library</h2></div>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">{props.catalog?.packageName ?? props.library?.packageName ?? "Not configured"}</p>
      </header>

      <div className="shrink-0 border-b border-white/10 px-3 py-3">
        <p className="px-1 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-600">Library source</p>
        <SourceOption
          active={props.mode === "development"}
          description={props.catalog?.development ? "Attached source · Editable" : "Not attached"}
          disabled={!props.catalog?.development}
          icon={<Radio aria-hidden="true" size={13} />}
          label="Development"
          onPress={() => props.onModeChange("development")}
        />
        <SourceOption
          active={props.mode === "release"}
          description={props.catalog?.release ? `${props.catalog.release.version} · Read only` : "Not installed"}
          disabled={!props.catalog?.release}
          icon={<PackageCheck aria-hidden="true" size={13} />}
          label="Installed package"
          onPress={() => props.onModeChange("release")}
        />
        <div className="mt-3 flex items-center justify-between px-1 text-[9px] text-zinc-600">
          <span>Design coverage</span><span className={ready === components.length && ready > 0 ? "text-emerald-400" : "text-amber-300"}>{ready}/{components.length}</span>
        </div>
      </div>

      {source ? (
        <SourceWorkspaceTree
          emptyMessage="No component source roots are available from this library."
          focusNodeId={focusNodeId}
          key={`library-${props.mode}`}
          rootLabels={rootLabels}
          rootNodeIds={rootNodeIds}
          selected={treeSelection}
          trailingRows={unresolvedRoots.length ? (
            <MissingLibraryRoots
              components={unresolvedRoots}
              selected={selected}
              source={source}
              onSelect={props.onSelect}
            />
          ) : undefined}
          workspace={source}
          onFocus={(_, selection) => {
            const occurrence = selection.occurrenceId ? graph.occurrences.get(selection.occurrenceId) : undefined;
            if (occurrence) selectRoot(occurrence.node);
          }}
          onSelect={selectTree}
        />
      ) : (
        <div aria-label="Source tree" className="min-h-0 flex-1 overflow-y-auto py-2" role="tree">
          <MissingLibraryRoots
            components={components}
            selected={selected}
            onSelect={props.onSelect}
          />
        </div>
      )}
    </aside>
  );
}

function MissingLibraryRoots(props: {
  components: readonly LibraryComponent[];
  selected?: string;
  source?: { entries: readonly RuntimeSourceWorkspaceEntry[] };
  onSelect: (id: string) => void;
}) {
  if (!props.components.length) return null;
  return (
    <>
      {props.components.map((component) => (
        <div aria-label={component.label} aria-level={1} key={component.id} className="relative flex min-h-10 items-center pr-2 pl-8" role="treeitem">
          <Button
            className={`min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-md px-1.5 text-left text-xs ${props.selected === component.id ? "bg-sky-500/15 text-sky-100" : "text-zinc-500 hover:bg-white/[0.04]"}`}
            fullWidth
            variant="ghost"
            onPress={() => props.onSelect(component.id)}
          >
            <Diamond className="text-violet-500/45" size={12} />
            <span className="min-w-0 truncate">{component.label}</span>
          </Button>
          <span className="absolute right-3">
            <SourceDesignStatus
              designPath={component.entry ? suggestedSourceDesignPath(component.entry, props.source?.entries ?? []) : "No registered source file"}
              label={component.label}
            />
          </span>
        </div>
      ))}
    </>
  );
}

function SourceOption(props: {
  active: boolean;
  description: string;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-pressed={props.active}
      className={`mt-2 h-12 w-full justify-start gap-2 rounded-none border-l-2 px-2 text-left ${props.active ? "border-sky-400 bg-sky-400/[0.05]" : "border-white/10"}`}
      isDisabled={props.disabled}
      variant="ghost"
      onPress={props.onPress}
    >
      <span className={props.active ? "text-sky-300" : "text-zinc-600"}>{props.icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium text-zinc-300">{props.label}</span>
        <span className="block truncate text-[9px] text-zinc-600">{props.description}</span>
      </span>
    </Button>
  );
}

export function SourceLibraryCanvas(props: SourceLibraryProps) {
  const component = selectedSourceLibraryComponent(props);
  const source = selectedCatalog(props);
  if (!component) return <LibraryState title="No component selected" message="Choose a component from the native design catalog." />;
  if (!component.entry) {
    return <LibraryState title="Design missing" message={`${component.label} is exported by the package, but this package does not include a colocated native design.`} />;
  }
  return (
    <SourcePreviewFrame
      centerContent
      device={props.device}
      entry={component.entry}
      entries={source?.entries}
      generateDesignError={props.generatingDesignEntryId === component.entry.id ? props.generateDesignError : undefined}
      generatingDesign={props.generatingDesignEntryId === component.entry.id}
      runtime="react"
      selectedClassCss={props.selectedClassCss}
      selectedClassName={props.selectedClassName}
      selectedLayer={props.selectedLayer}
      selectedText={props.selectedText}
      isolateSelectedLayer={false}
      mode={props.previewMode}
      selectionMode={props.selectionMode}
      styles={source?.styles ?? []}
      onGenerateDesign={props.mode === "development" && props.onGenerateDesign ? () => props.onGenerateDesign?.(component.entry!) : undefined}
      onDeviceChange={props.onDeviceChange}
      onModeChange={props.onPreviewModeChange}
      onSelectLayer={props.onSelectLayer}
      onSelectedLayerMetrics={props.onSelectedLayerMetrics}
    />
  );
}

function LibraryState(props: { message: string; title: string }) {
  return (
    <div className="grid h-full min-h-0 place-items-center bg-[#0d0e10] p-8 text-center">
      <div className="max-w-sm"><PackageCheck className="mx-auto text-zinc-700" size={22} /><h2 className="mt-3 text-sm font-semibold text-zinc-300">{props.title}</h2><p className="mt-2 text-xs leading-5 text-zinc-600">{props.message}</p></div>
    </div>
  );
}

export function SourceLibraryInspector(props: SourceLibraryProps) {
  const component = selectedSourceLibraryComponent(props);
  return (
    <aside aria-label="Component library evidence" className="h-full w-full bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500"><PackageCheck size={14} /><span className="text-[10px] font-medium uppercase tracking-[0.14em]">Library evidence</span></div>
      <dl className="mt-5 space-y-4 text-xs">
        <div><dt className="text-zinc-600">Package</dt><dd className="mt-1 font-mono text-zinc-300">{props.catalog?.packageName ?? props.library?.packageName ?? "Not configured"}</dd></div>
        <div><dt className="text-zinc-600">Selected source</dt><dd className="mt-1 text-zinc-300">{props.mode === "development" ? "Attached development source" : `Installed ${props.catalog?.release?.version ?? "package"}`}</dd></div>
        <div><dt className="text-zinc-600">Access</dt><dd className="mt-1 flex items-center gap-1.5 text-zinc-300"><LockKeyhole size={12} />{props.mode === "development" ? "Editable source" : "Read-only release"}</dd></div>
        {component ? <div><dt className="text-zinc-600">Selected export</dt><dd className="mt-1 font-mono text-zinc-300">{component.label}</dd><dd className={`mt-1 text-[10px] ${component.entry?.design ? "text-emerald-400" : "text-amber-300"}`}>{component.entry?.design ? "Native design ready" : "Native design missing"}</dd></div> : null}
      </dl>
    </aside>
  );
}

export type LibraryComponent = {
  entry?: RuntimeSourceWorkspaceEntry;
  id: string;
  label: string;
};

function libraryRootNodes(
  components: readonly LibraryComponent[],
  nodes: readonly SourceTreeNode[],
): readonly { component: LibraryComponent; node: SourceTreeNode }[] {
  const seen = new Set<string>();
  return components.flatMap((component) => {
    const node = component.entry
      ? nodes.find((candidate) => candidate.entries.some((entry) => entry.id === component.entry?.id))
      : nodes.find((candidate) => candidate.label === component.label);
    if (!node || seen.has(node.id)) return [];
    seen.add(node.id);
    return [{ component, node }];
  });
}

type SourceLibrarySelectionProps = Pick<SourceLibraryProps, "catalog" | "library" | "mode" | "selected">;

export function selectedSourceLibraryCatalog(props: Pick<SourceLibraryProps, "catalog" | "mode">) {
  return props.mode === "development" ? props.catalog?.development : props.catalog?.release;
}

const selectedCatalog = selectedSourceLibraryCatalog;

function selectedLibraryWorkspace(props: Pick<SourceLibraryProps, "catalog" | "library" | "mode">): RuntimeSourceWorkspace | undefined {
  if (props.mode === "development") return props.catalog?.development;
  const release = props.catalog?.release;
  if (!release) return undefined;
  return {
    runtime: props.catalog?.development?.runtime ?? "react",
    sourceRoot: "package",
    entries: release.entries,
    devices: [],
    styles: release.styles,
    ...(props.library ? { library: props.library } : {}),
  };
}

function libraryComponents(props: SourceLibrarySelectionProps): readonly LibraryComponent[] {
  const source = selectedCatalog(props);
  if (props.mode === "development") {
    const entries = source?.entries ?? [];
    const exported = props.library?.components ?? [];
    if (!exported.length) return entries.map((entry) => ({ entry, id: entry.id, label: entry.label }));
    return exported.map(({ name }) => ({
      entry: developmentEntry(entries, name),
      id: `library.development.${name}`,
      label: name,
    }));
  }
  const entries = new Map(source?.entries.map((entry) => [entry.label, entry]) ?? []);
  const exported = props.library?.components ?? [];
  const names = exported.length ? exported.map((component) => component.name) : [...entries.keys()];
  return names.map((name) => ({ entry: entries.get(name), id: entries.get(name)?.id ?? `library.release.${name}`, label: name }));
}

function developmentEntry(entries: readonly RuntimeSourceWorkspaceEntry[], name: string) {
  const exact = entries.filter((entry) => entry.exportName === name || entry.label === name);
  const exactDesign = exact.find((entry) => entry.design);
  if (exactDesign) return exactDesign;
  if (name.startsWith("Primitive")) {
    const primitiveName = name.slice("Primitive".length);
    const primitive = entries.find((entry) => entry.design && entry.label === primitiveName && entry.relativePath.includes("/primitives/"));
    if (primitive) return primitive;
  }
  return exact[0];
}

function resolvedSelectedLibraryComponentId(props: SourceLibrarySelectionProps): string | undefined {
  const components = libraryComponents(props);
  return components.some((component) => component.id === props.selected) ? props.selected : components[0]?.id;
}

export function selectedSourceLibraryComponent(props: SourceLibrarySelectionProps): LibraryComponent | undefined {
  const selected = resolvedSelectedLibraryComponentId(props);
  return libraryComponents(props).find((component) => component.id === selected);
}
