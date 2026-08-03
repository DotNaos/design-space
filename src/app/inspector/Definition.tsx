

export function Definition({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 border-t border-white/5 py-2 first:border-t-0"><dt className="text-zinc-600">{label}</dt><dd className="min-w-0 break-words text-zinc-300">{value}</dd></div>;
}
