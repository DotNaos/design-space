import { Boxes, FileCode2, Layers3, Search, SlidersHorizontal } from "lucide-react";

export type WorkspaceMode = "tree" | "files" | "catalog" | "search" | "inspector";

const actions: { label: string; mode: WorkspaceMode; icon: typeof Boxes; narrowOnly?: boolean }[] = [
  { label: "Component tree", mode: "tree", icon: Layers3 },
  { label: "Files", mode: "files", icon: FileCode2 },
  { label: "Catalog", mode: "catalog", icon: Boxes },
  { label: "Search", mode: "search", icon: Search },
  { label: "Inspector", mode: "inspector", icon: SlidersHorizontal, narrowOnly: true },
];

export function ActivityRail(props: { active: WorkspaceMode; onChange: (mode: WorkspaceMode) => void; className?: string }) {
  return (
    <nav aria-label="Workspace tools" className={`${props.className ?? "flex"} w-12 shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-[#101113] py-2`}>
      {actions.map(({ label, mode, icon: Icon, narrowOnly }) => {
        const active = props.active === mode;
        return (
        <button
          key={label}
          aria-label={label}
          className={`relative size-9 place-items-center rounded-lg transition-colors ${narrowOnly ? "grid xl:hidden" : "grid"} ${active ? "bg-white/10 text-zinc-100" : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"}`}
          type="button"
          onClick={() => props.onChange(mode)}
        >
          {active && <span className="absolute -left-1.5 h-5 w-0.5 rounded-full bg-indigo-400" />}
          <Icon size={17} />
        </button>
      );})}
    </nav>
  );
}
