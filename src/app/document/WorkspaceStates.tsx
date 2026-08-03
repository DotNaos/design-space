import { Button } from "@heroui/react";
import { NoSelectionPrompt } from "./NoSelectionPrompt";
import { BlockedOrLoading } from "./BlockedOrLoading";

export function workspaceStatusText(phase: string | undefined, dirty: boolean): string {
  if (phase === "stale") return "Source changed outside Design Space · Reset reloads the registered document";
  if (phase === "strict-blocked") return "Strict UI blocked this revision · open findings to continue";
  if (phase === "compile-error") return "Compile failed · the last safe preview remains visible";
  if (phase === "diff-ready") return "Exact diff ready · Save writes the registered target only";
  if (phase === "saving") return "Saving registered source transaction…";
  if (phase === "saved") return "Saved and reopened from source";
  return dirty ? "Local draft · source unchanged" : "Source-backed document · no unsaved changes";
}

export function workspaceStatusTone(phase: string | undefined, connected: boolean, error?: string): string {
  if (error || phase === "compile-error" || phase === "strict-blocked") return "bg-rose-400";
  if (phase === "stale") return "bg-amber-400";
  return connected ? "bg-emerald-400" : "bg-zinc-500";
}

export function InspectorPrompt({ className, onEdit }: { className?: string; onEdit: () => void }) {
  return <aside className={`${className ?? "grid w-80"} min-h-0 min-w-0 shrink-0 place-items-center border-l border-white/10 bg-[#141518] px-6 text-center`}><Button className="text-xs text-zinc-500 hover:text-zinc-200" variant="ghost" onPress={onEdit}>Edit selected item</Button></aside>;
}

export { NoSelectionPrompt } from "./NoSelectionPrompt";
export { BlockedOrLoading } from "./BlockedOrLoading";
