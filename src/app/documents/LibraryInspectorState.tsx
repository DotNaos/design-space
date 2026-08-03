

export function LibraryInspectorState(props: { label?: string; readOnly: boolean }) {
  return (
    <section aria-label="Library component access" className="h-full w-full bg-[#141518] px-4 py-5">
      <p className="text-[9px] font-semibold text-sky-400">Library access</p>
      <h2 className="mt-2 text-sm font-semibold text-zinc-100">{props.label ?? "No component selected"}</h2>
      {props.label ? (
        <dl className="mt-5 space-y-4 text-[11px]">
          <div><dt className="text-zinc-600">Source</dt><dd className="mt-1 text-zinc-300">{props.readOnly ? "Target library" : "Project authored"}</dd></div>
          <div><dt className="text-zinc-600">Access</dt><dd className={`mt-1 ${props.readOnly ? "text-zinc-300" : "text-emerald-400"}`}>{props.readOnly ? "Read only" : "Editable"}</dd></div>
        </dl>
      ) : <p className="mt-3 text-[11px] leading-5 text-zinc-500">Choose a catalog entry to see whether it comes from the target library or this project.</p>}
    </section>
  );
}
