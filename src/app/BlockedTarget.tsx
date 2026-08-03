

export function BlockedTarget({ message }: { message: string }) {
  return <main className="grid h-dvh place-items-center bg-[#0d0e10] p-8 text-center text-zinc-200"><div><p className="text-sm font-medium text-rose-300">Target adapter blocked</p><p className="mt-2 max-w-md text-xs text-zinc-500">{message}</p></div></main>;
}
