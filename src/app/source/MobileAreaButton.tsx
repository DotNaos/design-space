import { Button, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

export function MobileAreaButton(props: {
  active: boolean;
  children: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={350}>
      <Button
        aria-current={props.active ? "page" : undefined}
        aria-label={props.label}
        className={`h-8 min-w-0 shrink-0 gap-1 rounded-full px-2.5 text-[10px] font-medium transition-colors ${props.active ? "bg-[#292b31] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
        <span>{props.label}</span>
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl" placement="bottom">
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
