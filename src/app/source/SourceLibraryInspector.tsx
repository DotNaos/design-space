
import { LockKeyhole, PackageCheck } from "lucide-react";
import { SourceLibraryProps, selectedSourceLibraryComponent } from "./SourceLibraryWorkspace";

export function SourceLibraryInspector(props: SourceLibraryProps) {
  const component = selectedSourceLibraryComponent(props);
  const app = props.catalogKind === "app";
  return (
    <aside aria-label="Component library evidence" className="h-full w-full bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500"><PackageCheck size={14} /><span className="text-[10px] font-medium">{app ? "App component" : "Library evidence"}</span></div>
      <dl className="mt-5 space-y-4 text-xs">
        <div><dt className="text-zinc-600">{app ? "Source root" : "Package"}</dt><dd className="mt-1 font-mono text-zinc-300">{app ? props.appWorkspace?.sourceRoot ?? "src" : props.catalog?.packageName ?? props.library?.packageName ?? "Not configured"}</dd></div>
        <div><dt className="text-zinc-600">Selected source</dt><dd className="mt-1 text-zinc-300">{app ? component?.entry?.relativePath ?? "App source" : props.mode === "development" ? "Attached development source" : `Installed ${props.catalog?.release?.version ?? "package"}`}</dd></div>
        <div><dt className="text-zinc-600">Access</dt><dd className="mt-1 flex items-center gap-1.5 text-zinc-300"><LockKeyhole size={12} />{app ? "Edit from the App workspace" : props.mode === "development" ? "Editable source" : "Read-only release"}</dd></div>
        {component ? <div><dt className="text-zinc-600">Selected export</dt><dd className="mt-1 font-mono text-zinc-300">{component.label}</dd><dd className={`mt-1 text-[10px] ${component.entry?.design ? "text-emerald-400" : "text-amber-300"}`}>{component.entry?.design ? "Native design ready" : "Native design missing"}</dd></div> : null}
      </dl>
    </aside>
  );
}
