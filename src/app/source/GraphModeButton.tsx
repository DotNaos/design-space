import { Button, Tooltip } from "@heroui/react";

export function GraphModeButton(props: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={350}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={`size-6 min-w-6 ${props.active ? "bg-violet-400/15 text-violet-200" : "text-zinc-500"}`}
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
