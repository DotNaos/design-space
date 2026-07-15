import { Button } from "@heroui/react";

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

export function NoSelectionPrompt({ className }: { className?: string }) {
  return <aside className={`${className ?? "grid w-80"} min-h-0 min-w-0 shrink-0 place-items-center border-l border-white/10 bg-[#141518] px-6 text-center`}><p className="max-w-48 text-xs leading-5 text-zinc-500">Select an element on the canvas or in Layers.</p></aside>;
}

export function BlockedOrLoading(props: { loading: boolean; message?: string }) {
  return <main className="grid h-dvh place-items-center bg-[#0d0e10] p-8 text-center text-zinc-200"><div><p className={`text-sm font-medium ${props.loading ? "text-zinc-300" : "text-rose-300"}`}>{props.loading ? "Opening registered documents…" : "Document workspace blocked"}</p>{props.message && <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">{props.message}</p>}</div></main>;
}
