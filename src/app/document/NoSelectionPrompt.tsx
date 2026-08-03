

export function NoSelectionPrompt({ className }: { className?: string }) {
  return <aside className={`${className ?? "grid w-80"} min-h-0 min-w-0 shrink-0 place-items-center border-l border-white/10 bg-[#141518] px-6 text-center`}><p className="max-w-48 text-xs leading-5 text-zinc-500">Select an element on the canvas or in Layers.</p></aside>;
}
