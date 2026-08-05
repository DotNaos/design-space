import { Button, Tooltip } from "@heroui/react";

export function HudButton(props: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip closeDelay={80} delay={350}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={`size-5 min-w-5 rounded ${props.active ? "bg-sky-400/15 text-sky-200" : "text-zinc-600 hover:bg-white/5 hover:text-zinc-200"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
