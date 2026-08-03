import { Button } from "@heroui/react";
import type { ReactNode } from "react";

export function DetailTab(props: { active: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Button
      aria-pressed={props.active}
      className={`h-7 min-w-0 gap-1.5 rounded-md px-2.5 text-[10px] ${props.active ? "bg-sky-400/10 text-sky-200" : "text-zinc-500"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.icon}{props.label}
    </Button>
  );
}
