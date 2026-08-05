

export function BlockedOrLoading(props: { loading: boolean; message?: string }) {
  return <main className="grid h-dvh place-items-center bg-[#0d0e10] p-8 text-center text-zinc-200"><div><p className={`text-sm font-medium ${props.loading ? "text-zinc-300" : "text-rose-300"}`}>{props.loading ? "Opening registered documents…" : "Document workspace blocked"}</p>{props.message && <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">{props.message}</p>}</div></main>;
}
