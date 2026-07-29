import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { Component, Diamond, Library, LockKeyhole, PackageCheck, Radio, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import {
  filterSourceCatalog,
  selectedSourceCatalogComponent,
  sourceCatalogComponents,
  type SourceCatalogComponent,
  type SourceCatalogKind,
  type SourceLibraryCategory,
} from "./source-library-catalog";
import type { SourceLibraryMode } from "./useSourceLibraryRuntime";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source-layer-design";

interface SourceLibraryProps {
  appWorkspace?: RuntimeSourceWorkspace;
  catalog?: RuntimeSourceLibraryCatalog;
  catalogKind: SourceCatalogKind;
  device: DesignSpaceDevice;
  library?: SourceWorkspaceLibrary;
  mode: SourceLibraryMode;
  selected?: string;
  selectedLayer?: import("../../shared/source-workspace").SourceWorkspaceLayer;
  selectedClassName?: string;
  selectedClassCss?: string;
  selectedText?: string;
  selectedDesignCase?: string;
  selectionMode?: boolean;
  previewMode?: SourcePreviewMode;
  treeStateKey?: string;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onDesignCaseChange?: (caseName: string) => void;
  onCatalogKindChange: (kind: SourceCatalogKind) => void;
  onModeChange: (mode: SourceLibraryMode) => void;
  onSelectLayer?: (layerId: string | undefined) => void;
  onPreviewModeChange?: (mode: SourcePreviewMode) => void;
  onSelectedLayerMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
  generateDesignError?: string;
  generatingDesignEntryId?: string;
  onGenerateDesign?: (entry: RuntimeSourceWorkspaceEntry) => void;
}

export function SourceLibrarySidebar(props: SourceLibraryProps & { onSelect: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SourceLibraryCategory>("all");
  const components = useMemo(() => catalogComponents(props, props.catalogKind), [
    props.appWorkspace,
    props.catalog,
    props.catalogKind,
    props.device,
    props.library,
    props.mode,
  ]);
  const visible = useMemo(
    () => filterSourceCatalog(components, query, props.catalogKind === "app" ? "all" : category),
    [category, components, props.catalogKind, query],
  );
  const selected = selectedSourceCatalogComponent(components, props.selected)?.id;
  useEffect(() => {
    const fallback = visible[0];
    if (fallback && !visible.some((component) => component.id === props.selected)) {
      props.onSelect(fallback.id);
    }
  }, [props.onSelect, props.selected, visible]);
  const ready = components.filter((component) => component.entry?.design).length;
  return (
    <aside aria-label="Component catalog" className="flex h-full min-h-0 w-full flex-col bg-[#141518]">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2"><Library className="text-sky-400" size={15} /><h2 className="text-sm font-semibold text-zinc-100">Components</h2></div>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">
          {props.catalogKind === "app"
            ? props.appWorkspace?.sourceRoot ?? "App source"
            : props.catalog?.packageName ?? props.library?.packageName ?? "Not configured"}
        </p>
      </header>

      <div className="shrink-0 border-b border-white/10 p-3">
        <div aria-label="Component source" className="grid grid-cols-2 rounded-lg bg-black/20 p-0.5" role="group">
          <CatalogKindButton
            active={props.catalogKind === "app"}
            count={catalogComponents(props, "app").length}
            label="App"
            onPress={() => props.onCatalogKindChange("app")}
          />
          <CatalogKindButton
            active={props.catalogKind === "library"}
            count={catalogComponents(props, "library").length}
            label="UI library"
            onPress={() => props.onCatalogKindChange("library")}
          />
        </div>
        {props.catalogKind === "library" ? (
          <div className="mt-3 grid grid-cols-2 gap-1">
            <SourceOption
              active={props.mode === "development"}
              description={props.catalog?.development ? "Editable" : "Not attached"}
              disabled={!props.catalog?.development}
              icon={<Radio aria-hidden="true" size={12} />}
              label="Development"
              onPress={() => props.onModeChange("development")}
            />
            <SourceOption
              active={props.mode === "release"}
              description={props.catalog?.release?.version ?? "Not installed"}
              disabled={!props.catalog?.release}
              icon={<PackageCheck aria-hidden="true" size={12} />}
              label="Installed"
              onPress={() => props.onModeChange("release")}
            />
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between text-[9px] text-zinc-600">
          <span>Design coverage</span>
          <span className={ready === components.length && ready > 0 ? "text-emerald-400" : "text-amber-300"}>
            {ready}/{components.length}
          </span>
        </div>
        <TextField className="mt-3" value={query} onChange={setQuery}>
          <Label className="sr-only">Search components</Label>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2">
            <Search aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
            <Input className="min-w-0 flex-1 bg-transparent text-xs text-zinc-300 outline-none" placeholder="Search components" />
          </div>
        </TextField>
        {props.catalogKind === "library" ? (
          <CategoryFilter value={category} onChange={setCategory} />
        ) : null}
      </div>

      <div aria-label="Component list" className="min-h-0 flex-1 overflow-y-auto py-2" role="list">
        {visible.map((component) => (
          <CatalogComponentRow
            component={component}
            key={component.id}
            selected={selected === component.id}
            source={selectedCatalogWorkspace(props)}
            onSelect={props.onSelect}
          />
        ))}
        {!visible.length ? (
          <p className="px-5 py-10 text-center text-xs leading-5 text-zinc-600">
            {query.trim() ? `No components match “${query.trim()}”.` : "No components are available in this catalog."}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function CatalogComponentRow(props: {
  component: SourceCatalogComponent;
  selected: boolean;
  source?: { entries: readonly RuntimeSourceWorkspaceEntry[] };
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative mx-2 flex min-h-10 items-center" role="listitem">
      <Button
        aria-pressed={props.selected}
        className={`min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-md px-2 pr-9 text-left text-xs ${
          props.selected
            ? "bg-sky-500/15 text-sky-100"
            : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        }`}
        fullWidth
        variant="ghost"
        onPress={() => props.onSelect(props.component.id)}
      >
        <Diamond className="shrink-0 text-violet-400/70" size={12} />
        <span className="min-w-0 flex-1 truncate">{props.component.label}</span>
        <span className="shrink-0 text-[8px] uppercase tracking-wide text-zinc-700">
          {props.component.category === "primitive" ? "Primitive" : props.component.category === "composed" ? "Component" : ""}
        </span>
      </Button>
      {!props.component.entry?.design ? (
        <span className="absolute right-2">
          <SourceDesignStatus
            designPath={props.component.entry
              ? suggestedSourceDesignPath(props.component.entry, props.source?.entries ?? [])
              : "No registered source file"}
            label={props.component.label}
          />
        </span>
      ) : null}
    </div>
  );
}

function CatalogKindButton(props: { active: boolean; count: number; label: string; onPress: () => void }) {
  return (
    <Button
      aria-pressed={props.active}
      className={`h-8 min-w-0 rounded-md px-2 text-[10px] ${
        props.active ? "bg-white/10 text-zinc-200" : "text-zinc-600"
      }`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <Component aria-hidden="true" size={12} />
      <span className="truncate">{props.label}</span>
      <span className="tabular-nums text-zinc-600">{props.count}</span>
    </Button>
  );
}

function CategoryFilter(props: {
  value: SourceLibraryCategory;
  onChange: (value: SourceLibraryCategory) => void;
}) {
  const options = [
    { id: "all", label: "All components" },
    { id: "primitive", label: "Primitives" },
    { id: "composed", label: "Composed" },
  ] satisfies readonly { id: SourceLibraryCategory; label: string }[];
  return (
    <Select
      aria-label="Component category"
      className="mt-2 w-full"
      selectedKey={props.value}
      onSelectionChange={(key) => props.onChange(String(key) as SourceLibraryCategory)}
    >
      <Select.Trigger className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 text-[10px] text-zinc-300 outline-none data-[focus-visible]:border-sky-300/40">
        <Select.Value className="min-w-0 flex-1 truncate text-left" />
        <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
      </Select.Trigger>
      <Select.Popover placement="bottom" className="min-w-44 rounded-lg border border-white/10 bg-[#18191c] p-1 shadow-2xl">
        <ListBox items={options}>
          {(item) => (
            <ListBox.Item
              className="flex min-h-8 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[focused]:bg-white/10 data-[selected]:text-sky-300"
              id={item.id}
              textValue={item.label}
            >
              {item.label}
              <ListBox.ItemIndicator className="ml-auto size-3" />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
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
      className={`h-11 min-w-0 justify-start gap-2 rounded-md border px-2 text-left ${
        props.active ? "border-sky-400/30 bg-sky-400/[0.05]" : "border-white/10"
      }`}
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
  const source = selectedCatalogWorkspace(props);
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
      selectedDesignCase={props.selectedDesignCase}
      selectedLayer={props.selectedLayer}
      selectedText={props.selectedText}
      isolateSelectedLayer={false}
      mode={props.previewMode}
      selectionMode={props.selectionMode}
      styles={source?.styles ?? []}
      onGenerateDesign={(props.catalogKind === "app" || props.mode === "development") && props.onGenerateDesign
        ? () => props.onGenerateDesign?.(component.entry!)
        : undefined}
      onDeviceChange={props.onDeviceChange}
      onDesignCaseChange={props.onDesignCaseChange}
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
  const app = props.catalogKind === "app";
  return (
    <aside aria-label="Component library evidence" className="h-full w-full bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500"><PackageCheck size={14} /><span className="text-[10px] font-medium uppercase tracking-[0.14em]">{app ? "App component" : "Library evidence"}</span></div>
      <dl className="mt-5 space-y-4 text-xs">
        <div><dt className="text-zinc-600">{app ? "Source root" : "Package"}</dt><dd className="mt-1 font-mono text-zinc-300">{app ? props.appWorkspace?.sourceRoot ?? "src" : props.catalog?.packageName ?? props.library?.packageName ?? "Not configured"}</dd></div>
        <div><dt className="text-zinc-600">Selected source</dt><dd className="mt-1 text-zinc-300">{app ? component?.entry?.relativePath ?? "App source" : props.mode === "development" ? "Attached development source" : `Installed ${props.catalog?.release?.version ?? "package"}`}</dd></div>
        <div><dt className="text-zinc-600">Access</dt><dd className="mt-1 flex items-center gap-1.5 text-zinc-300"><LockKeyhole size={12} />{app ? "Edit from the App workspace" : props.mode === "development" ? "Editable source" : "Read-only release"}</dd></div>
        {component ? <div><dt className="text-zinc-600">Selected export</dt><dd className="mt-1 font-mono text-zinc-300">{component.label}</dd><dd className={`mt-1 text-[10px] ${component.entry?.design ? "text-emerald-400" : "text-amber-300"}`}>{component.entry?.design ? "Native design ready" : "Native design missing"}</dd></div> : null}
      </dl>
    </aside>
  );
}

type SourceLibrarySelectionProps = Pick<
  SourceLibraryProps,
  "appWorkspace" | "catalog" | "catalogKind" | "device" | "library" | "mode" | "selected"
>;

export function selectedSourceLibraryCatalog(props: Pick<SourceLibraryProps, "catalog" | "mode">) {
  return props.mode === "development" ? props.catalog?.development : props.catalog?.release;
}

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

function selectedCatalogWorkspace(
  props: Pick<SourceLibraryProps, "appWorkspace" | "catalog" | "catalogKind" | "library" | "mode">,
): RuntimeSourceWorkspace | undefined {
  return props.catalogKind === "app" ? props.appWorkspace : selectedLibraryWorkspace(props);
}

function catalogComponents(
  props: Pick<SourceLibraryProps, "appWorkspace" | "catalog" | "device" | "library" | "mode">,
  kind: SourceCatalogKind,
) {
  return sourceCatalogComponents({
    appWorkspace: props.appWorkspace,
    catalog: props.catalog,
    device: props.device,
    kind,
    library: props.library,
    mode: props.mode,
  });
}

export function selectedSourceLibraryComponent(props: SourceLibrarySelectionProps): SourceCatalogComponent | undefined {
  return selectedSourceCatalogComponent(catalogComponents(props, props.catalogKind), props.selected);
}
