import { Button } from "@heroui/react";
import { MonitorPlay, PencilRuler } from "lucide-react";

import type { SourceWorkspaceMode } from "./source-layer-design";

export function SourceWorkspacePageNavigation(props: {
  mode: SourceWorkspaceMode;
  onChange: (mode: SourceWorkspaceMode) => void;
}) {
  return (
    <nav aria-label="Workspace pages" className="flex h-8 items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.035] p-0.5">
      <PageButton active={props.mode === "design"} label="Design" onPress={() => props.onChange("design")}>
        <PencilRuler aria-hidden="true" size={13} />
      </PageButton>
      <PageButton active={props.mode === "preview"} label="Preview" onPress={() => props.onChange("preview")}>
        <MonitorPlay aria-hidden="true" size={13} />
      </PageButton>
    </nav>
  );
}

function PageButton(props: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      className={`h-6 gap-1.5 rounded-md px-2.5 text-[10px] font-medium transition-colors ${props.active ? "bg-white/[0.09] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.children}
      {props.label}
    </Button>
  );
}
