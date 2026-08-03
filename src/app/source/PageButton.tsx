import { Button, Tooltip } from "@heroui/react";

export function PageButton(props: {
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
