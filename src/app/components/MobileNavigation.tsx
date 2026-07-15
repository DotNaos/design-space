import { ToggleButton } from "@heroui/react";
import { Boxes, Eye, FileCode2, Layers3, SlidersHorizontal } from "lucide-react";

export type MobileWorkspaceMode = "preview" | "tree" | "catalog" | "files" | "inspector";

const actions: { label: string; mode: MobileWorkspaceMode; icon: typeof Boxes }[] = [
  { label: "Tree", mode: "tree", icon: Layers3 },
  { label: "Files", mode: "files", icon: FileCode2 },
  { label: "Preview", mode: "preview", icon: Eye },
  { label: "Catalog", mode: "catalog", icon: Boxes },
  { label: "Inspect", mode: "inspector", icon: SlidersHorizontal },
];

export function MobileNavigation(props: {
  active: MobileWorkspaceMode;
  onChange: (mode: MobileWorkspaceMode) => void;
}) {
  return (
    <nav aria-label="Mobile workspace" className="grid h-[calc(3.5rem+env(safe-area-inset-bottom))] shrink-0 grid-cols-5 border-t border-white/10 bg-[#101113] pb-[env(safe-area-inset-bottom)] lg:hidden">
      {actions.map(({ label, mode, icon: Icon }) => {
        const active = props.active === mode;
        return (
          <ToggleButton
            key={mode}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={`relative flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-none px-0 text-[9px] transition-colors ${active ? "text-sky-300" : "text-zinc-500"}`}
            isSelected={active}
            variant="ghost"
            onChange={(selected) => { if (selected) props.onChange(mode); }}
          >
            {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-sky-400" />}
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            <span className="truncate">{label}</span>
          </ToggleButton>
        );
      })}
    </nav>
  );
}
