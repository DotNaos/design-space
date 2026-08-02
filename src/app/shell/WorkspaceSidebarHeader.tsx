import { Button, Tooltip } from "@heroui/react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { RunningTargetSwitcher, type WorkspaceSurfaceNavigation } from "./RunningTargetSwitcher";

export function WorkspaceSidebarHeader(props: {
  controls: string;
  surfaceNavigation?: WorkspaceSurfaceNavigation;
  targetLabel: string;
  visible: boolean;
  onToggle: () => void;
  inline?: boolean;
}) {
  if (props.inline) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <WorkspaceSidebarToggle
          controls={props.controls}
          label="project sidebar"
          visible={props.visible}
          onToggle={props.onToggle}
        />
        <div className="min-w-0 flex-1">
          <RunningTargetSwitcher surfaceNavigation={props.surfaceNavigation} targetLabel={props.targetLabel} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-12 min-w-0 items-center gap-1 border-b border-white/[0.08] bg-[#101113] px-1.5">
      <WorkspaceSidebarToggle
        controls={props.controls}
        label="project sidebar"
        visible={props.visible}
        onToggle={props.onToggle}
      />
      {props.visible ? (
        <div className="min-w-0 flex-1">
          <RunningTargetSwitcher surfaceNavigation={props.surfaceNavigation} targetLabel={props.targetLabel} />
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceSidebarToggle(props: {
  controls?: string;
  label: string;
  side?: "left" | "right";
  visible: boolean;
  onToggle: () => void;
}) {
  const Icon = props.side === "right"
    ? props.visible ? PanelRightClose : PanelRightOpen
    : props.visible ? PanelLeftClose : PanelLeftOpen;
  const action = props.visible ? "Hide" : "Show";
  return (
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-controls={props.controls}
        aria-expanded={props.visible}
        aria-label={`${action} ${props.label}`}
        className="size-8 min-w-8 rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
        size="sm"
        variant="ghost"
        onPress={props.onToggle}
      >
        <Icon aria-hidden="true" size={15} />
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {action} {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
