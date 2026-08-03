import { Button } from "@heroui/react";
import { CircleAlert, Trash2 } from "lucide-react";
import { type SourceChangeReviewItem } from "./source-change-review";
import { PreviewSide } from "./PreviewSide";
import { SourceDiff } from "./SourceDiff";

export function ChangeComparison(props: { applying: boolean; change: SourceChangeReviewItem; onDiscard?: (id: string) => void }) {
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
      {props.change.validationMessage && (
        <p className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-4 text-amber-300" role="alert">
          {props.change.validationMessage}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-2" data-testid="source-change-comparison-grid">
          <PreviewSide label="Before" preview={props.change.before.preview} />
          <PreviewSide label="After" preview={props.change.after.preview} />
        </div>
        <SourceDiff change={props.change} />
      </div>
    </section>
  );
}
