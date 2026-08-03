import { Button } from "@heroui/react";

export function NarrowToolbarTab(props: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      className={`h-7 min-w-20 flex-1 justify-center gap-1 rounded-full px-3 text-[9px] transition-colors ${props.active ? "bg-[#303239] text-white" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.children}
      {props.label}
    </Button>
  );
}
