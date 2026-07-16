import { Button } from "@heroui/react";
import { Boxes, Code2, Library, LockKeyhole, PackageCheck } from "lucide-react";

import type { SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { PreviewCanvas } from "../components/PreviewCanvas";

const libraryPreviewId = "library-component-preview";

export function SourceLibrarySidebar(props: {
  library?: SourceWorkspaceLibrary;
  selected?: string;
  onSelect: (name: string) => void;
}) {
  return (
    <aside aria-label="Component library catalog" className="flex h-full min-h-0 w-full flex-col bg-[#141518]">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2"><Library className="text-sky-400" size={15} /><h2 className="text-sm font-semibold text-zinc-100">Component Library</h2></div>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">{props.library?.packageName ?? "Not connected"}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {props.library?.components.map((component) => (
          <Button
            key={component.name}
            className={`min-h-10 w-full justify-start rounded-none px-4 text-xs ${props.selected === component.name ? "bg-sky-500/15 text-sky-100" : "text-zinc-400 hover:bg-white/[0.04]"}`}
            fullWidth
            variant="ghost"
            onPress={() => props.onSelect(component.name)}
          ><Code2 size={13} /><span className="truncate">{component.name}</span></Button>
        ))}
        {props.library && props.library.components.length === 0 && <p className="px-4 py-3 text-[10px] leading-4 text-zinc-600">No component imports from this package were found in the project source.</p>}
        {!props.library && <p className="px-4 py-3 text-[10px] leading-4 text-zinc-600">No development or release package was proven for this project.</p>}
      </div>
      {props.library && (
        <footer className="shrink-0 border-t border-white/10 px-4 py-3 text-[9px]">
          <span className={props.library.mode === "development" ? "text-amber-300" : "text-zinc-500"}>{props.library.mode === "development" ? "Development package detected · editing not registered" : "Release package · read only"}</span>
        </footer>
      )}
    </aside>
  );
}

export function SourceLibraryCanvas(props: { library?: SourceWorkspaceLibrary; selected?: string }) {
  const component = props.library?.components.find((candidate) => candidate.name === props.selected);
  const label = component?.name ?? "Component library";
  return <PreviewCanvas
    cameraKey={`library:${component?.name ?? "empty"}`}
    preview={(
      <section
        data-design-space-instance-id={libraryPreviewId}
        className="grid min-h-72 w-[480px] place-items-center rounded-xl border border-white/10 bg-[#141518] px-8 text-center shadow-2xl"
      >
        {component ? (
          <div className="max-w-sm">
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-white/10 bg-[#17181b] text-sky-400"><Boxes size={20} /></div>
            <h2 className="mt-4 text-base font-semibold text-zinc-100">{component.name}</h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500">This real package symbol is proven by the project. Design Space will render it here once the library exposes a catalog story or it can run without invented required props.</p>
          </div>
        ) : (
          <div className="max-w-sm"><Library className="mx-auto text-zinc-700" size={22} /><h2 className="mt-3 text-sm font-semibold text-zinc-300">Select a library component</h2></div>
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

export function SourceLibraryInspector(props: { library?: SourceWorkspaceLibrary; selected?: string }) {
  const component = props.library?.components.find((candidate) => candidate.name === props.selected);
  return (
    <aside aria-label="Component library evidence" className="h-full w-full bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500"><PackageCheck size={14} /><span className="text-[10px] font-medium uppercase tracking-[0.14em]">Library evidence</span></div>
      {props.library ? (
        <dl className="mt-5 space-y-4 text-xs">
          <div><dt className="text-zinc-600">Package</dt><dd className="mt-1 font-mono text-zinc-300">{props.library.packageName}</dd></div>
          <div><dt className="text-zinc-600">Version</dt><dd className="mt-1 font-mono text-zinc-300">{props.library.version}</dd></div>
          <div><dt className="text-zinc-600">Access</dt><dd className={`mt-1 flex items-center gap-1.5 ${props.library.mode === "development" ? "text-amber-300" : "text-zinc-300"}`}><LockKeyhole size={12} />{props.library.mode === "development" ? "Development package · write root not registered" : "Read-only release"}</dd></div>
          {component && <div><dt className="text-zinc-600">Selected export</dt><dd className="mt-1 font-mono text-zinc-300">{component.name}</dd><dd className="mt-1 text-[10px] text-zinc-600">Proven by {component.evidence === "project-import" ? "a project import" : "the package export map"}</dd></div>}
        </dl>
      ) : <p className="mt-4 text-xs leading-5 text-zinc-500">No component-library dependency was proven for this target.</p>}
    </aside>
  );
}
