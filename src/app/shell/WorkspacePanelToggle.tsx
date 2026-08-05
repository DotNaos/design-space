
import { Button, Tooltip } from "@heroui/react";
import { type WorkspacePanelWidths } from "./workspace-panel-state";
import { PanelToggleIcon } from "./PanelToggleIcon";

export function WorkspacePanelToggle(props: {
  controls: string;
  label: string;
  side: keyof WorkspacePanelWidths;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-controls={props.controls}
        aria-expanded={props.visible}
        aria-label={`${props.visible ? "Hide" : "Show"} ${props.label}`}
        className="mt-2 size-7 min-w-7 rounded-lg border-0 bg-[#17181b]/95 text-zinc-500 shadow-lg shadow-black/20 backdrop-blur hover:bg-[#202126] hover:text-zinc-200"
        data-workspace-panel-toggle={props.side}
        size="sm"
        variant="ghost"
        onPress={props.onToggle}
      >
        <PanelToggleIcon side={props.side} visible={props.visible} />
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {props.visible ? "Hide" : "Show"} {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
