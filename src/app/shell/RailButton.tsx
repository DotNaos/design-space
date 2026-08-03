import { Button, Tooltip } from "@heroui/react";

export function RailButton(props: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Tooltip delay={250}>
      <Button
        aria-current={props.active ? "page" : undefined}
        aria-label={props.label}
        className={`relative size-10 min-w-10 rounded-xl transition-colors ${props.active ? "bg-sky-500 text-white shadow-[0_8px_24px_rgba(14,165,233,0.24)]" : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"}`}
        isDisabled={props.disabled}
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content placement="right" showArrow>{props.label}</Tooltip.Content>
    </Tooltip>
  );
}
