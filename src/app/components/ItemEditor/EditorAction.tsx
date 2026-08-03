import { Button } from "@heroui/react";

export function EditorAction(props: {
  ariaLabel: string;
  icon: React.ReactNode;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      aria-label={props.ariaLabel}
      className={`group relative size-9 min-w-9 overflow-visible rounded-lg ${props.danger ? "ml-auto text-rose-400 hover:bg-rose-400/10" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"}`}
      isDisabled={props.disabled}
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.icon}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.375rem)] z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[9px] font-medium text-zinc-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {props.ariaLabel}
      </span>
    </Button>
  );
}
