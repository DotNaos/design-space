
import { ShieldCheck } from "lucide-react";
import type { SourceApprovalEvidence, SourceWorkspaceEntry } from "../../shared/source-workspace";
import { approvalCounts } from "./SourceApprovalStatus";

export function SourceApprovalReviewSummary(props: {
  approvals: SourceApprovalEvidence | undefined;
  entries: readonly SourceWorkspaceEntry[];
}) {
  const counts = approvalCounts(props.approvals, props.entries);
  const toReview = counts.total - counts.approved;
  return (
    <section
      aria-label="Approval review"
      className="flex min-h-9 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4"
    >
      <ShieldCheck aria-hidden="true" className="text-zinc-500" size={13} />
      <p className="text-[10px] font-medium text-zinc-400">Approval</p>
      <p className="ml-auto font-mono text-[9px] tabular-nums text-zinc-500">
        <span className="text-emerald-400">{counts.approved} / {counts.total} approved</span>
        {toReview > 0 && <span className="text-amber-300/80"> · {toReview} to review</span>}
      </p>
    </section>
  );
}
