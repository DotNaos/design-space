import { Button } from "@heroui/react";
import { Boxes, CircleAlert, Code2, Library, LoaderCircle, LockKeyhole, PackageCheck, Play, Radio, Square } from "lucide-react";

import type { LibraryRuntimeStatus } from "../../shared/contracts";
import type { SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { PreviewCanvas } from "../components/PreviewCanvas/PreviewCanvas";
import type { SourceLibraryMode } from "./useSourceLibraryRuntime";

const libraryPreviewId = "library-component-preview";

interface LibraryRuntimeProps {
  error?: string;
  library?: SourceWorkspaceLibrary;
  mode: SourceLibraryMode;
  pending: boolean;
  runtime?: LibraryRuntimeStatus;
  onModeChange: (mode: SourceLibraryMode) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SourceLibrarySidebar(props: LibraryRuntimeProps & {
  selected?: string;
  onSelect: (name: string) => void;
}) {
  const development = props.runtime?.development;
  const components = libraryComponents(props);
  return (
    <aside aria-label="Component library catalog" className="flex h-full min-h-0 w-full flex-col bg-[#141518]">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2"><Library className="text-sky-400" size={15} /><h2 className="text-sm font-semibold text-zinc-100">Component Library</h2></div>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">{props.runtime?.packageName ?? props.library?.packageName ?? "Not configured"}</p>
      </header>

      <div className="shrink-0 border-b border-white/10 px-3 py-3">
        <p className="px-1 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-600">Library source</p>
        <SourceOption
          active={props.mode === "development"}
          description={developmentDescription(development)}
          icon={<Radio aria-hidden="true" size={13} />}
          label="Development"
          onPress={() => props.onModeChange("development")}
        >
          {development?.configured && development.state !== "running" && (
            <Button className="h-7 min-w-0 gap-1.5 px-2 text-[10px]" isPending={props.pending} size="sm" variant="secondary" onPress={props.onStart}>
              {development.state === "starting" ? <LoaderCircle className="animate-spin" size={12} /> : <Play size={12} />}
              {development.state === "failed" ? "Retry" : "Start & use"}
            </Button>
          )}
          {development?.state === "running" && development.managed && (
            <Button aria-label="Stop development library" className="size-7 min-w-0 px-0 text-zinc-500" isDisabled={props.pending} isIconOnly size="sm" variant="ghost" onPress={props.onStop}><Square size={11} /></Button>
          )}
        </SourceOption>
        <SourceOption
          active={props.mode === "release"}
          description={props.runtime?.release ? `${props.runtime.release.version} · Read only` : "Not installed"}
          disabled={!props.runtime?.release}
          icon={<PackageCheck aria-hidden="true" size={13} />}
          label="Installed package"
          onPress={() => props.onModeChange("release")}
        />
        {props.error && <p className="mt-2 flex gap-1.5 px-1 text-[9px] leading-4 text-red-300"><CircleAlert className="mt-0.5 shrink-0" size={11} />{props.error}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {components.map((component) => (
          <Button
            key={component.id}
            className={`min-h-10 w-full justify-start rounded-none px-4 text-xs ${selectedLibraryComponent(props) === component.id ? "bg-sky-500/15 text-sky-100" : "text-zinc-400 hover:bg-white/[0.04]"}`}
            fullWidth
            variant="ghost"
            onPress={() => props.onSelect(component.id)}
          ><Code2 size={13} /><span className="min-w-0 truncate">{component.label}</span>{props.mode === "development" && <span className="ml-auto max-w-24 truncate text-[8px] text-zinc-700">{component.group}</span>}</Button>
        ))}
        {components.length === 0 && <p className="px-4 py-3 text-[10px] leading-4 text-zinc-600">{development?.state === "running" && props.mode === "development" ? "The development catalog is loading…" : "Start Development or use the installed package to load its component catalog."}</p>}
      </div>
    </aside>
  );
}

function SourceOption(props: {
  active: boolean;
  children?: React.ReactNode;
  description: string;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <div className={`mt-2 flex min-h-12 items-center gap-2 border-l-2 px-2 py-1.5 ${props.active ? "border-sky-400 bg-sky-400/[0.05]" : "border-white/10"}`}>
      <Button
        aria-pressed={props.active}
        className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 text-left"
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
      {props.children}
    </div>
  );
}

export function SourceLibraryCanvas(props: LibraryRuntimeProps & { selected?: string }) {
  const development = props.runtime?.development;
  if (props.mode === "development" && development?.state === "running" && development.url) {
    const component = libraryComponents(props).find((candidate) => candidate.id === selectedLibraryComponent(props));
    if (!component) return <DevelopmentCatalogLoading {...props} />;
    const previewUrl = new URL("/iframe.html", development.url);
    previewUrl.searchParams.set("id", component.id);
    previewUrl.searchParams.set("viewMode", "story");
    return (
      <div className="h-full min-h-0 w-full bg-[#0d0e10] p-3">
        <div className="flex h-full min-h-0 flex-col border border-white/10 bg-[#141518]">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/10 px-3"><Radio className="text-emerald-400" size={12} /><span className="truncate text-[10px] font-medium text-zinc-300">{component.label}</span><span className="ml-auto truncate text-[9px] text-zinc-600">{component.group}</span></div>
          <iframe className="min-h-0 flex-1 bg-white" src={previewUrl.toString()} title={`Development preview: ${component.label}`} />
        </div>
      </div>
    );
  }
  if (props.mode === "development") {
    return <LibraryLauncherState {...props} />;
  }
  return <ReleaseLibraryCanvas library={props.library} selected={props.selected} version={props.runtime?.release?.version} />;
}

function LibraryLauncherState(props: LibraryRuntimeProps) {
  const development = props.runtime?.development;
  return (
    <div className="grid h-full min-h-0 place-items-center bg-[#0d0e10] p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-xl border border-white/10 bg-[#17181b] text-sky-400"><Library size={20} /></div>
        <h2 className="mt-4 text-base font-semibold text-zinc-100">{developmentTitle(development)}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          {development?.configured ? "Start the registered library server here. Design Space will connect as soon as it is ready." : "Register a trusted development root and command in .designspace.ts."}
        </p>
        {development?.configured && (
          <Button className="mt-5 gap-2" isPending={props.pending || development.state === "starting"} onPress={props.onStart}>
            {development.state === "starting" ? <LoaderCircle className="animate-spin" size={14} /> : <Play size={14} />}
            {development.state === "failed" ? "Retry development library" : "Start development library"}
          </Button>
        )}
        {props.runtime?.release && <Button className="mt-2" variant="ghost" onPress={() => props.onModeChange("release")}>Use installed version {props.runtime.release.version}</Button>}
        {(props.error || development?.error) && <p className="mt-4 text-[10px] leading-4 text-red-300">{props.error ?? development?.error}</p>}
      </div>
    </div>
  );
}

function DevelopmentCatalogLoading(props: LibraryRuntimeProps) {
  return (
    <div className="grid h-full min-h-0 place-items-center bg-[#0d0e10] p-8 text-center">
      <div><LoaderCircle className="mx-auto animate-spin text-sky-400" size={20} /><h2 className="mt-4 text-sm font-semibold text-zinc-200">Loading development catalog</h2><p className="mt-2 text-xs text-zinc-600">The library is running. Its component stories will appear here automatically.</p><Button className="mt-4" variant="ghost" onPress={() => void props.onModeChange("release")}>Use installed package meanwhile</Button></div>
    </div>
  );
}

function ReleaseLibraryCanvas(props: { library?: SourceWorkspaceLibrary; selected?: string; version?: string }) {
  const component = props.library?.components.find((candidate) => candidate.name === props.selected);
  const label = component?.name ?? "Component library";
  return <PreviewCanvas
    cameraKey={`library:${component?.name ?? "empty"}`}
    preview={(
      <section data-design-space-instance-id={libraryPreviewId} className="grid min-h-72 w-[480px] place-items-center border border-white/10 bg-[#141518] px-8 text-center shadow-2xl">
        {component ? (
          <div className="max-w-sm">
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-white/10 bg-[#17181b] text-sky-400"><Boxes size={20} /></div>
            <h2 className="mt-4 text-base font-semibold text-zinc-100">{component.name}</h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Installed package {props.version ?? props.library?.version} · read only</p>
          </div>
        ) : (
          <div className="max-w-sm"><PackageCheck className="mx-auto text-zinc-700" size={22} /><h2 className="mt-3 text-sm font-semibold text-zinc-300">Installed component library</h2><p className="mt-2 text-xs text-zinc-600">Select a component from the catalog.</p></div>
        )}
      </section>
    )}
    rootInstanceId={libraryPreviewId}
    selectedComponentInstanceId={libraryPreviewId}
    selection={{ kind: "component", id: libraryPreviewId }}
    selectionLabel={label}
    slots={[]}
    worldWidth={480}
    onSelect={() => undefined}
  />;
}

export function SourceLibraryInspector(props: LibraryRuntimeProps & { selected?: string }) {
  const component = libraryComponents(props).find((candidate) => candidate.id === selectedLibraryComponent(props));
  const development = props.runtime?.development;
  return (
    <aside aria-label="Component library evidence" className="h-full w-full bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500"><PackageCheck size={14} /><span className="text-[10px] font-medium uppercase tracking-[0.14em]">Library evidence</span></div>
      <dl className="mt-5 space-y-4 text-xs">
        <div><dt className="text-zinc-600">Package</dt><dd className="mt-1 font-mono text-zinc-300">{props.runtime?.packageName ?? props.library?.packageName ?? "Not configured"}</dd></div>
        <div><dt className="text-zinc-600">Selected source</dt><dd className="mt-1 text-zinc-300">{props.mode === "development" ? "Development" : `Installed ${props.runtime?.release?.version ?? "package"}`}</dd></div>
        <div><dt className="text-zinc-600">Access</dt><dd className="mt-1 flex items-center gap-1.5 text-zinc-300"><LockKeyhole size={12} />{props.mode === "development" ? development?.state === "running" ? "Live development" : "Development offline" : "Read-only release"}</dd></div>
        {component && <div><dt className="text-zinc-600">Selected export</dt><dd className="mt-1 font-mono text-zinc-300">{component.label}</dd>{props.mode === "development" && <dd className="mt-1 text-[10px] text-zinc-600">{component.group}</dd>}</div>}
      </dl>
    </aside>
  );
}

function developmentDescription(development: LibraryRuntimeStatus["development"] | undefined): string {
  if (!development?.configured) return "Not configured";
  if (development.state === "running") return development.managed ? "Running · Editable" : "Running externally · Editable";
  if (development.state === "starting") return "Starting…";
  if (development.state === "failed") return "Start failed";
  return "Stopped";
}

function developmentTitle(development: LibraryRuntimeStatus["development"] | undefined): string {
  if (!development?.configured) return "Development library is not configured";
  if (development.state === "starting") return "Development library is starting";
  if (development.state === "failed") return "Development library failed to start";
  return "Development library is stopped";
}

function libraryComponents(props: Pick<LibraryRuntimeProps, "library" | "mode" | "runtime">) {
  if (props.mode === "development") return props.runtime?.development.components ?? [];
  return (props.library?.components ?? []).map((component) => ({ id: component.name, label: component.name, group: props.library?.packageName ?? "Installed package" }));
}

function selectedLibraryComponent(props: Pick<LibraryRuntimeProps, "library" | "mode" | "runtime"> & { selected?: string }): string | undefined {
  const components = libraryComponents(props);
  return components.some((component) => component.id === props.selected) ? props.selected : components[0]?.id;
}
