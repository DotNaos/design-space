import { Button } from "@heroui/react";
import { ArrowRight, Check, Fingerprint, MessageSquareWarning } from "lucide-react";

import type {
  RuntimeSourceWorkspaceEntry,
  SourceApprovalEvidence,
} from "../../shared/source-workspace";

export interface SourceComponentReviewCheckpointProps {
  approved: number;
  dirty: boolean;
  entry: RuntimeSourceWorkspaceEntry;
  error?: string;
  evidence?: SourceApprovalEvidence;
  index: number;
  signing: boolean;
  stateCount?: number;
  total: number;
  onNext?: () => void;
  onRequestChanges: () => void;
  onSign: () => void;
}

export function SourceComponentReviewCheckpoint(props: SourceComponentReviewCheckpointProps) {
  const state = componentCheckpointState(props);
  return (
    <section
      aria-label={`Review checkpoint for ${props.entry.label}`}
      className="pointer-events-auto min-w-0 max-w-56 overflow-hidden"
      data-testid="source-component-review-checkpoint"
    >
      <div className="flex h-6 min-w-0 items-center gap-0.5">
        <span
          aria-hidden="true"
          className={`mx-1 size-1.5 shrink-0 rounded-full ${state.tone === "approved" ? "bg-emerald-300" : "bg-amber-300/80"}`}
          title={state.detail}
        />
        <p className="max-w-20 truncate px-0.5 text-[9px] font-semibold text-zinc-300">{props.entry.label}</p>
        <span className="shrink-0 px-0.5 font-mono text-[9px] tabular-nums text-zinc-600">{props.index + 1}/{props.total}</span>
        <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.07]" />
        <span className="sr-only">{state.detail}</span>
        <Button
          aria-label={`Request changes for ${props.entry.label}`}
          className="size-5 min-w-5 shrink-0 rounded text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-100"
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={props.onRequestChanges}
        >
          <MessageSquareWarning aria-hidden="true" size={13} />
        </Button>
        {state.tone === "approved" ? (
          <Button
            aria-label={props.onNext ? "Open next component" : "All reachable components reviewed"}
            className="size-5 min-w-5 shrink-0 rounded bg-emerald-300/90 text-emerald-950 hover:bg-emerald-200"
            isDisabled={!props.onNext}
            isIconOnly
            size="sm"
            onPress={props.onNext}
          >
            {props.onNext ? <ArrowRight aria-hidden="true" size={13} /> : <Check aria-hidden="true" size={13} />}
          </Button>
        ) : (
          <Button
            aria-label={`Sign ${props.entry.label} with Touch ID`}
            className={`size-5 min-w-5 shrink-0 rounded ${state.canSign || props.signing ? "bg-fuchsia-300/90 text-fuchsia-950 hover:bg-fuchsia-200" : "text-zinc-700"}`}
            isDisabled={!state.canSign}
            isIconOnly
            isPending={props.signing}
            size="sm"
            onPress={props.onSign}
          >
            <Fingerprint aria-hidden="true" size={14} />
          </Button>
        )}
      </div>
      {props.error ? <p className="px-3 py-1.5 text-[9px] text-rose-300" role="alert">{props.error}</p> : null}
    </section>
  );
}

function componentCheckpointState(props: SourceComponentReviewCheckpointProps): {
  canSign: boolean;
  detail: string;
  tone: "approved" | "pending";
} {
  const approval = props.evidence?.components[props.entry.id];
  if (approval?.state === "approved") return { canSign: false, detail: "Signed for the current component revision", tone: "approved" };
  if (props.dirty) return { canSign: false, detail: "Apply the pending source change before signing", tone: "pending" };
  if (props.entry.findings.length) return { canSign: false, detail: `Resolve ${props.entry.findings.length} structural issue${props.entry.findings.length === 1 ? "" : "s"} before signing`, tone: "pending" };
  if (!props.evidence || props.evidence.status === "not-configured") return { canSign: false, detail: props.evidence?.reason ?? "Component signing is not configured", tone: "pending" };
  if (props.evidence.status === "unavailable") return { canSign: false, detail: props.evidence.reason ?? "Approval verification is unavailable", tone: "pending" };
  if (!approval) return { canSign: false, detail: "Add this component scope to the approval policy", tone: "pending" };
  if (approval.state === "invalid") return { canSign: false, detail: approval.reason ?? "Fix the invalid approval evidence before signing", tone: "pending" };
  return { canSign: !props.signing, detail: approval.state === "stale" ? "Changed since its last signature" : "Ready for one Touch ID checkpoint", tone: "pending" };
}
