

export function PreviewSide(props: { label: "After" | "Before"; preview: React.ReactNode }) {
  return (
    <section aria-label={`${props.label} change`} className="min-w-0 overflow-hidden rounded-md border border-white/[0.08] bg-[#0d0e10]">
      <h3 className="border-b border-white/[0.07] px-3 py-2 text-[10px] font-medium text-zinc-500">{props.label}</h3>
      <div aria-label={`${props.label} preview`} className="grid h-52 place-items-center overflow-auto bg-[#101113] p-4" role="region">
        {props.preview}
      </div>
    </section>
  );
}
