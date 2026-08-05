import { Button } from "@heroui/react";
import type { ReactNode } from "react";

export function ReviewViewButton(props: { active: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Button
      aria-label={props.label}
      aria-pressed={props.active}
      className={`h-7 min-w-0 rounded-full px-3 text-[10px] ${props.active ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-200"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.icon}<span className="hidden whitespace-nowrap sm:inline">{props.label}</span>
    </Button>
  );
}
