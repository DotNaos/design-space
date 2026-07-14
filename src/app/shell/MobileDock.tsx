import { Boxes, Files, Layers3, LayoutGrid, Library, SlidersHorizontal } from "lucide-react";

export type MobilePane = "documents" | "files" | "tree" | "canvas" | "catalog" | "inspect";

const actions = [
  { pane: "documents" as const, label: "Docs", icon: LayoutGrid },
  { pane: "files" as const, label: "Files", icon: Files },
  { pane: "tree" as const, label: "Tree", icon: Layers3 },
  { pane: "canvas" as const, label: "Canvas", icon: Boxes },
  { pane: "catalog" as const, label: "Catalog", icon: Library },
  { pane: "inspect" as const, label: "Inspect", icon: SlidersHorizontal },
];

export function MobileDock(props: { active: MobilePane; onChange: (pane: MobilePane) => void }) {
  return (
    <nav aria-label="Mobile workspace" className="grid h-[calc(3.75rem+env(safe-area-inset-bottom))] shrink-0 grid-cols-6 border-t border-white/10 bg-[#101113] pb-[env(safe-area-inset-bottom)] lg:hidden">
      {actions.map(({ pane, label, icon: Icon }) => {
        const active = props.active === pane;
        return (
          <button key={pane} aria-current={active ? "page" : undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[9px] ${active ? "text-indigo-300" : "text-zinc-500"}`} type="button" onClick={() => props.onChange(pane)}>
            {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-indigo-400" />}
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            <span className="max-w-full truncate px-0.5">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
