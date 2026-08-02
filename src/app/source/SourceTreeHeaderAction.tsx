import { Button, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

export function SourceTreeHeaderAction(props: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip closeDelay={80} delay={350}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={props.active
          ? "grid size-7 min-w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20"
          : "grid size-7 min-w-7 place-items-center rounded-lg text-zinc-500 hover:text-zinc-100"}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content
        className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl"
        placement="bottom"
      >
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
