import { Button } from "@heroui/react";
import { type ReactNode } from "react";

export function SourceOption(props: {
  active: boolean;
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-pressed={props.active}
      className={`h-9 w-full min-w-0 justify-start gap-1.5 rounded-full px-2.5 text-left transition-colors ${
        props.active ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.04]"
      }`}
      fullWidth
      isDisabled={props.disabled}
      variant="ghost"
      onPress={props.onPress}
    >
      <span className={props.active ? "text-sky-300" : "text-zinc-600"}>{props.icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-medium leading-3.5">{props.label}</span>
        <span className="block truncate text-[8px] leading-3 text-zinc-600">{props.description}</span>
      </span>
    </Button>
  );
}
