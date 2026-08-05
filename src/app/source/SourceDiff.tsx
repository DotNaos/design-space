
import { Diff, LoaderCircle } from "lucide-react";
import { Suspense } from "react";
import { type SourceChangeReviewItem } from "./source-change-review";
import { MonacoSourceDiff } from "./SourceChangeReviewModal";
import type { SourceDiffMode } from "./MonacoSourceDiff";

export function SourceDiff(props: { change: SourceChangeReviewItem; mode: SourceDiffMode }) {
  const unified = props.mode === "unified";
  return (
    <section aria-label={unified ? "Unified source diff" : "Split source diff"} className="flex h-full min-h-[32rem] flex-1 flex-col overflow-hidden rounded-xl bg-[#0d0e10]">
      <header className="flex h-9 items-center gap-2 border-b border-white/[0.07] px-3">
        <Diff aria-hidden="true" className="text-sky-300" size={13} />
        <h3 className="text-[10px] font-medium text-zinc-400">{unified ? "Unified diff" : "Split diff"}</h3>
        <span className="ml-auto text-[9px] text-zinc-600">{unified ? "Inline changes" : "Synchronized scroll"}</span>
      </header>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="grid h-full place-items-center text-[10px] text-zinc-600"><LoaderCircle className="animate-spin" size={14} /> Loading highlighted diff…</div>}>
          <MonacoSourceDiff
            key={`${props.change.id}:${props.mode}`}
            mode={props.mode}
            modified={props.change.after.source}
            original={props.change.before.source}
            path={props.change.path}
          />
        </Suspense>
      </div>
    </section>
  );
}
