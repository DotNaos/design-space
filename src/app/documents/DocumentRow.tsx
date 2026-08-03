
import { Button } from "@heroui/react";
import { Component, PanelsTopLeft } from "lucide-react";
import type { TargetDocumentEntry } from "../../shared/target-module";

export function DocumentRow(props: { active: boolean; entry: TargetDocumentEntry; onPress: () => void }) {
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      fullWidth
      className={`relative flex h-9 min-h-9 justify-start gap-2 rounded-lg px-2 text-xs ${props.active ? "bg-sky-500/15 text-sky-100 before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-400" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
      variant="ghost"
      onPress={props.onPress}
    >
      {props.entry.kind === "screen" ? <PanelsTopLeft aria-hidden="true" size={14} /> : <Component aria-hidden="true" size={14} />}
      <span className="truncate">{props.entry.label}</span>
    </Button>
  );
}
