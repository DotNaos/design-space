import { Input, Label, TextField } from "@heroui/react";
import { Library, Radio, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { DesignSpaceDevice, RuntimeSourceLibraryCatalog, RuntimeSourceWorkspace, RuntimeSourceWorkspaceEntry, SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { filterSourceCatalog, selectedSourceCatalogComponent, sourceCatalogComponents, type SourceCatalogComponent, type SourceCatalogKind, type SourceLibraryCategory } from "./source-library-catalog";
import type { SourceLibraryMode } from "./useSourceLibraryRuntime";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source-layer-design";
import { LibraryDevelopmentSourceControl } from "./LibraryDevelopmentSourceControl";
import { LibraryReleaseSourceControl } from "./LibraryReleaseSourceControl";
import { CatalogComponentRow } from "./CatalogComponentRow";
import { CategoryFilter } from "./CategoryFilter";
import { SourceOption } from "./SourceOption";
import { SourceLibraryCanvas } from "./SourceLibraryCanvas";
import { SourceLibraryInspector } from "./SourceLibraryInspector";

export interface SourceLibraryProps {
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
  workspaceNavigation?: ReactNode;
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

export function SourceLibrarySidebar(
  props: SourceLibraryProps & {
    details?: ReactNode;
    onSelect: (name: string) => void;
  },
) {
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
  const sections = useMemo(
    () => catalogSections(visible, props.catalogKind),
    [props.catalogKind, visible],
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
    <aside aria-label="Component catalog" className="flex h-full min-h-0 w-full flex-col bg-[#0f1012]">
      <header className="shrink-0 bg-white/[0.018] px-4 py-4">
        <div className="flex items-center gap-2"><Library className="text-violet-300" size={15} /><h2 className="text-sm font-semibold text-zinc-100">Library</h2></div>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">
          {props.catalogKind === "app"
            ? props.appWorkspace?.sourceRoot ?? "App source"
            : props.catalog?.packageName ?? props.library?.packageName ?? "Not configured"}
        </p>
      </header>

      <div className="shrink-0 bg-white/[0.012] px-3 py-2.5">
        {props.catalogKind === "library" ? (
          <>
            <div className="grid grid-cols-2 rounded-full bg-white/[0.035] p-1">
              <SourceOption
                active={props.mode === "development"}
                description={props.catalog?.development ? "Editable" : "Not attached"}
                disabled={!props.catalog?.development}
                icon={<Radio aria-hidden="true" size={12} />}
                label="Development"
                onPress={() => props.onModeChange("development")}
              />
              <LibraryReleaseSourceControl
                active={props.mode === "release"}
                fallbackVersion={props.catalog?.release?.version ?? props.library?.version}
                onModeChange={props.onModeChange}
              />
            </div>
            <LibraryDevelopmentSourceControl onModeChange={props.onModeChange} />
          </>
        ) : null}
        <div className="mt-2.5 flex items-center justify-between px-0.5 text-[9px] text-zinc-600">
          <span>Design coverage</span>
          <span className={ready === components.length && ready > 0 ? "text-emerald-400" : "text-amber-300"}>
            {ready}/{components.length}
          </span>
        </div>
        <TextField className="mt-2.5" value={query} onChange={setQuery}>
          <Label className="sr-only">Search components</Label>
          <div className="flex h-9 items-center gap-2 rounded-full bg-white/[0.045] px-3 transition-colors focus-within:bg-white/[0.07]">
            <Search aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
            <Input className="min-w-0 flex-1 rounded-full bg-transparent text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600" placeholder="Search components" />
          </div>
        </TextField>
        {props.catalogKind === "library" ? (
          <CategoryFilter value={category} onChange={setCategory} />
        ) : null}
      </div>

      <div className={props.details
        ? "grid min-h-0 flex-1 grid-rows-[minmax(9rem,0.8fr)_minmax(12rem,1.2fr)]"
        : "min-h-0 flex-1"}
      >
        <div aria-label="Component list" className="min-h-0 overflow-y-auto py-2" role="list">
          {sections.map((section) => (
            <div aria-label={section.label} className="pb-2" key={section.id} role={section.label ? "group" : undefined}>
              {section.label ? (
                <h3 className="px-4 pb-1.5 pt-2 text-[9px] font-medium text-zinc-500">{section.label}</h3>
              ) : null}
              {section.components.map((component) => (
                <CatalogComponentRow
                  component={component}
                  key={component.id}
                  selected={selected === component.id}
                  source={selectedCatalogWorkspace(props)}
                  onSelect={props.onSelect}
                />
              ))}
            </div>
          ))}
          {!visible.length ? (
            <p className="px-5 py-10 text-center text-xs leading-5 text-zinc-600">
              {query.trim() ? `No components match “${query.trim()}”.` : "No components are available in this catalog."}
            </p>
          ) : null}
        </div>
        {props.details ? (
          <div className="min-h-0 bg-white/[0.012]">
            {props.details}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function catalogSections(components: readonly SourceCatalogComponent[], kind: SourceCatalogKind) {
  if (kind === "app") return [{ id: "app", label: undefined, components }];
  return [
    { id: "composed", label: "Components", components: components.filter((component) => component.category === "composed") },
    { id: "primitive", label: "Primitives", components: components.filter((component) => component.category === "primitive") },
  ].filter((section) => section.components.length > 0);
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

export function selectedCatalogWorkspace(
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

export { SourceLibraryCanvas } from "./SourceLibraryCanvas";
export { SourceLibraryInspector } from "./SourceLibraryInspector";
