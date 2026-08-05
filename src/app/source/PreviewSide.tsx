import { FileCode2, LoaderCircle } from "lucide-react";
import { Suspense } from "react";

import { MonacoReviewSource } from "./SourceChangeReviewModal";

export function PreviewSide(props: {
  label: "After" | "Before";
  path: string;
  preview: React.ReactNode;
  source: string;
}) {
  return (
    <section aria-label={`${props.label} change`} className="flex min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-xl bg-[#0d0e10]" role="region">
      <h3 className="px-3 py-2.5 text-[11px] font-medium text-zinc-300">{props.label}</h3>
      <div aria-label={`${props.label} preview`} className="grid h-52 place-items-center overflow-auto bg-[#101113] p-4" role="region">
        {props.preview}
      </div>
      <div className="flex h-9 shrink-0 items-center gap-2 border-t border-white/[0.07] px-3 text-zinc-500">
        <FileCode2 aria-hidden="true" className="text-sky-300" size={13} />
        <span className="text-[10px] font-medium">Code</span>
      </div>
      <div className="min-h-[22rem] flex-1 overflow-hidden border-t border-white/[0.07]">
        <Suspense fallback={<div className="grid h-full place-items-center text-[10px] text-zinc-600"><LoaderCircle className="animate-spin" size={14} /> Loading source…</div>}>
          <MonacoReviewSource
            ariaLabel={`${props.label} source`}
            path={props.path}
            value={props.source}
          />
        </Suspense>
      </div>
    </section>
  );
}
