import { Button } from "@heroui/react";
import { Columns2, Diff, ListTree, CircleAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { type SourceChangeReviewItem } from "./source-change-review";
import { PreviewSide } from "./PreviewSide";
import { ReviewViewButton } from "./ReviewViewButton";
import { SourceDiff } from "./SourceDiff";

type ReviewView = "compare" | "split" | "unified";

export function ChangeComparison(props: { applying: boolean; change: SourceChangeReviewItem; onDiscard?: (id: string) => void }) {
  const [view, setView] = useState<ReviewView>("compare");

  return (
    <section aria-label={`${props.change.label} comparison`} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-zinc-300">{props.change.label}</p>
          <p className="truncate font-mono text-[9px] text-zinc-600">{props.change.repository ? `${props.change.repository} · ` : ""}{props.change.path}</p>
        </div>
        {!props.change.valid && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-amber-300"><CircleAlert size={12} /> Validation failed</span>
        )}
        {props.onDiscard && (
          <Button
            aria-label={`Discard ${props.change.label}`}
            isDisabled={props.applying}
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => props.onDiscard?.(props.change.id)}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </header>
      <div className="flex shrink-0 justify-center border-b border-white/[0.07] px-3 py-2">
        <div aria-label="Review view" className="grid grid-cols-3 rounded-full bg-black/30 p-1" role="group">
          <ReviewViewButton active={view === "compare"} icon={<Columns2 size={13} />} label="Before / after" onPress={() => setView("compare")} />
          <ReviewViewButton active={view === "split"} icon={<Diff size={13} />} label="Split diff" onPress={() => setView("split")} />
          <ReviewViewButton active={view === "unified"} icon={<ListTree size={13} />} label="Unified diff" onPress={() => setView("unified")} />
        </div>
      </div>
      {props.change.validationMessage && (
        <p className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-4 text-amber-300" role="alert">
          {props.change.validationMessage}
        </p>
      )}
      <div className={`min-h-0 flex-1 p-3 sm:p-4 ${view === "compare" ? "overflow-y-auto" : "overflow-hidden"}`}>
        {view === "compare" ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="source-change-comparison-grid">
            <PreviewSide
              label="Before"
              path={props.change.path}
              preview={props.change.before.preview}
              source={props.change.before.source}
            />
            <PreviewSide
              label="After"
              path={props.change.path}
              preview={props.change.after.preview}
              source={props.change.after.source}
            />
          </div>
        ) : <SourceDiff change={props.change} mode={view} />}
      </div>
    </section>
  );
}
