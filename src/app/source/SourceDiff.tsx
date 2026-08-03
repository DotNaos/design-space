
import { Diff, LoaderCircle } from "lucide-react";
import { Suspense } from "react";
import { type SourceChangeReviewItem } from "./source-change-review";
import { MonacoSourceDiff } from "./SourceChangeReviewModal";

export function SourceDiff(props: { change: SourceChangeReviewItem }) {
  return (
    <section aria-label="Source diff" className="min-h-[22rem] flex-1 overflow-hidden rounded-md border border-white/[0.08] bg-[#0d0e10]">
      <header className="flex h-9 items-center gap-2 border-b border-white/[0.07] px-3">
        <Diff aria-hidden="true" className="text-sky-300" size={13} />
        <h3 className="text-[10px] font-medium text-zinc-500">Source diff</h3>
        <span className="ml-auto text-[9px] text-zinc-600">Synchronized scroll</span>
      </header>
      <div className="h-[calc(100%-2.25rem)] min-h-0">
        <Suspense fallback={<div className="grid h-full place-items-center text-[10px] text-zinc-600"><LoaderCircle className="animate-spin" size={14} /> Loading highlighted diff…</div>}>
          <MonacoSourceDiff
            key={props.change.id}
            modified={props.change.after.source}
            original={props.change.before.source}
            path={props.change.path}
          />
        </Suspense>
      </div>
    </section>
  );
}
