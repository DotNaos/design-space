import { Button, Tooltip } from "@heroui/react";
import { MonitorPlay, PencilRuler } from "lucide-react";

import type { SourceWorkspaceMode } from "./source-layer-design";

export function SourceWorkspacePageNavigation(props: {
  mode: SourceWorkspaceMode;
  onChange: (mode: SourceWorkspaceMode) => void;
}) {
  return (
    <nav aria-label="Workspace pages" className="flex h-7 items-center rounded-lg bg-black/20 p-0.5">
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
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-current={props.active ? "page" : undefined}
        aria-label={props.label}
        className={`size-6 min-w-6 rounded-md transition-colors ${props.active ? "bg-white/[0.11] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content className="rounded-lg border-0 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
