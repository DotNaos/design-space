import { Button } from "@heroui/react";
import { FolderKanban, Layers3, MonitorPlay, PencilRuler, SlidersHorizontal } from "lucide-react";

import { useMobileViewport } from "../components/MobileNavigation/use-mobile-viewport";

export type MobilePane = "documents" | "files" | "tree" | "canvas" | "catalog" | "inspect";
export type MobileDestination = "project" | "tree" | "canvas" | "inspect";
export type MobileWorkspacePage = "design" | "preview";

const actions = [
  { destination: "project" as const, pane: "documents" as const, label: "Project", icon: FolderKanban },
  { destination: "tree" as const, pane: "tree" as const, label: "Tree", icon: Layers3 },
  { destination: "inspect" as const, pane: "inspect" as const, label: "Inspect", icon: SlidersHorizontal },
];

export function MobileDock(props: {
  active: MobilePane;
  page?: MobileWorkspacePage;
  onChange: (pane: MobilePane) => void;
  onPageChange?: (page: MobileWorkspacePage) => void;
}) {
  const mobile = useMobileViewport();
  const activeDestination = mobileDestinationForPane(props.active);
  if (!mobile) return null;
  return (
    <nav aria-label="Mobile workspace tools" className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-[#17181b]/95 p-1 shadow-2xl backdrop-blur-sm lg:hidden">
      {props.page && props.onPageChange ? (
        <>
          <PageButton active={props.active === "canvas" && props.page === "design"} icon={PencilRuler} label="Design" onPress={() => props.onPageChange?.("design")} />
          <PageButton active={props.active === "canvas" && props.page === "preview"} icon={MonitorPlay} label="Preview" onPress={() => props.onPageChange?.("preview")} />
          <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-white/10" />
        </>
      ) : null}
      {actions.map(({ destination, pane, label, icon: Icon }) => {
        const active = activeDestination === destination;
        return (
          <Button key={destination} aria-label={active ? `Close ${label}` : `Open ${label}`} aria-pressed={active} className={`size-11 rounded-xl transition-colors ${active ? "bg-sky-400/15 text-sky-300" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`} isIconOnly variant="ghost" onPress={() => props.onChange(active ? "canvas" : pane)}>
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
          </Button>
        );
      })}
    </nav>
  );
}

function PageButton(props: {
  active: boolean;
  icon: typeof PencilRuler;
  label: string;
  onPress: () => void;
}) {
  const Icon = props.icon;
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      aria-label={`Open ${props.label} page`}
      className={`size-11 rounded-xl transition-colors ${props.active ? "bg-sky-400/15 text-sky-300" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}
      isIconOnly
      variant="ghost"
      onPress={props.onPress}
    >
      <Icon size={18} strokeWidth={props.active ? 2.2 : 1.8} />
    </Button>
  );
}

export function mobileDestinationForPane(pane: MobilePane): MobileDestination {
  return pane === "documents" || pane === "files" || pane === "catalog" ? "project" : pane;
}
