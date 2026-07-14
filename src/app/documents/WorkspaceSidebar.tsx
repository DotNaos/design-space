import { Boxes, Files, Layers3, LayoutGrid } from "lucide-react";

import type { WorkspaceBrowserView } from "./WorkspaceBrowser";

export type WorkspaceSidebarView = WorkspaceBrowserView | "tree";

const views = [
  { id: "documents" as const, label: "Documents", icon: LayoutGrid },
  { id: "files" as const, label: "Files", icon: Files },
  { id: "tree" as const, label: "Tree", icon: Layers3 },
  { id: "catalog" as const, label: "Catalog", icon: Boxes },
];

export function WorkspaceSidebar(props: {
  active: WorkspaceSidebarView;
  children: React.ReactNode;
  onChange: (view: WorkspaceSidebarView) => void;
}) {
  return (
    <aside aria-label="Workspace panel" className="flex h-full min-h-0 min-w-0 flex-col bg-[#141518]">
      <nav aria-label="Workspace views" className="grid h-12 shrink-0 grid-cols-4 border-b border-white/10 p-1">
        {views.map(({ id, label, icon: Icon }) => {
          const active = props.active === id;
          return (
            <button
              key={id}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`relative flex min-w-0 items-center justify-center gap-1 rounded-lg text-[10px] transition-colors ${active ? "bg-white/10 text-zinc-100" : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"}`}
              type="button"
              onClick={() => props.onChange(id)}
            >
              <Icon aria-hidden="true" size={14} />
              <span className="hidden truncate min-[1240px]:inline">{label}</span>
              {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-px bg-sky-400" />}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-hidden">{props.children}</div>
    </aside>
  );
}
