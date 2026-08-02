import { ToggleButton, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

export type EditorIconTab = {
  icon: ReactNode;
  label: string;
  value: string;
};

export function EditorIconTabs(props: {
  ariaLabel: string;
  tabs: readonly EditorIconTab[];
  value?: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <div
      aria-label={props.ariaLabel}
      className="grid gap-0 overflow-hidden rounded-xl bg-[#0d0e11]"
      data-editor-icon-tabs={props.ariaLabel}
      role="group"
      style={{ gridTemplateColumns: `repeat(${props.tabs.length}, minmax(0, 1fr))` }}
    >
      {props.tabs.map((tab) => {
        const active = props.value === tab.value;
        return (
          <Tooltip key={tab.value || "auto"} delay={300} closeDelay={80}>
            <ToggleButton
              isIconOnly
              aria-label={tab.label}
              className={`h-9 w-full min-w-0 max-w-none rounded-xl px-0 transition-[background-color,color,transform] duration-150 data-[pressed]:scale-[0.96] ${active ? "!bg-[#2997ff] !text-white" : "text-zinc-600 hover:bg-[#191b20] hover:text-zinc-200"}`}
              isSelected={active}
              size="sm"
              variant="ghost"
              onPointerEnter={() => props.onPreview?.(tab.value)}
              onPointerLeave={props.onPreviewEnd}
              onChange={() => props.onChange(tab.value)}
            >
              {tab.icon}
            </ToggleButton>
            <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
              {tab.label}
            </Tooltip.Content>
          </Tooltip>
        );
      })}
    </div>
  );
}
