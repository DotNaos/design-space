import { Tooltip } from "@heroui/react";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";

import type {
  SourceApprovalEvidence,
  SourceComponentApproval,
  SourceWorkspaceEntry,
} from "../../shared/source-workspace";

type ApprovalTone = "approved" | "invalid" | "stale" | "unreviewed" | "unavailable";

interface ApprovalAppearance {
  detail: string;
  icon: typeof ShieldCheck;
  iconClassName: string;
  label: string;
  rowClassName: string;
  tone: ApprovalTone;
}

export function sourceApprovalModeLabel(
  approvals: SourceApprovalEvidence | undefined,
  entries: readonly SourceWorkspaceEntry[],
): string {
  if (!approvals || approvals.status === "not-configured") {
    return "Show approval checklist · approvals not configured";
  }
  if (approvals.status === "unavailable") {
    return "Show approval checklist · verification unavailable";
  }
  const approved = entries.filter((entry) => approvals.components[entry.id]?.state === "approved").length;
  return `Show approval checklist · ${approved} of ${entries.length} approved`;
}

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

export function SourceApprovalStatus(props: {
  approvals: SourceApprovalEvidence | undefined;
  entry: SourceWorkspaceEntry;
}) {
  const approval = props.approvals?.components[props.entry.id];
  const appearance = approvalAppearance(props.approvals, approval);
  const Icon = appearance.icon;
  return (
    <Tooltip closeDelay={80} delay={300}>
      <span
        aria-label={appearance.label}
        className={`grid size-4 shrink-0 place-items-center ${appearance.iconClassName}`}
        role="img"
      >
        <Icon aria-hidden="true" size={11} />
      </span>
      <Tooltip.Content
        className="max-w-72 rounded-md border border-white/10 bg-[#202126] px-2.5 py-2 text-[10px] leading-4 text-zinc-200 shadow-xl"
        placement="right"
      >
        <p className="font-medium">{appearance.label}</p>
        <p className="text-zinc-500">{appearance.detail}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function sourceApprovalRowClassName(
  approvals: SourceApprovalEvidence | undefined,
  entry: SourceWorkspaceEntry,
): string {
  return approvalAppearance(approvals, approvals?.components[entry.id]).rowClassName;
}

function approvalAppearance(
  evidence: SourceApprovalEvidence | undefined,
  approval: SourceComponentApproval | undefined,
): ApprovalAppearance {
  if (!evidence || evidence.status === "not-configured") {
    return {
      icon: ShieldQuestion,
      iconClassName: "text-amber-300/80",
      label: "Unreviewed · approvals not configured",
      detail: evidence?.reason ?? "This project has no cryptographic approval policy.",
      rowClassName: "bg-amber-400/[0.025]",
      tone: "unreviewed",
    };
  }
  if (evidence.status === "unavailable") {
    return {
      icon: ShieldX,
      iconClassName: "text-red-400",
      label: "Approval verification unavailable",
      detail: evidence.reason ?? "The trusted verifier could not produce evidence.",
      rowClassName: "bg-red-400/[0.035]",
      tone: "unavailable",
    };
  }
  if (!approval) {
    return {
      icon: ShieldQuestion,
      iconClassName: "text-amber-300/80",
      label: "Unreviewed · no approval scope",
      detail: "The verified policy does not contain a scope for this component.",
      rowClassName: "bg-amber-400/[0.025]",
      tone: "unreviewed",
    };
  }
  if (approval.state === "approved") {
    return {
      icon: ShieldCheck,
      iconClassName: "text-emerald-400",
      label: `Approved · ${approval.label}`,
      detail: approval.attestation,
      rowClassName: "bg-emerald-400/[0.025]",
      tone: "approved",
    };
  }
  if (approval.state === "stale") {
    return {
      icon: ShieldAlert,
      iconClassName: "text-amber-300",
      label: `Changed after approval · ${approval.label}`,
      detail: approval.reason ?? "The signed content no longer matches the current component.",
      rowClassName: "bg-amber-400/[0.035]",
      tone: "stale",
    };
  }
  if (approval.state === "invalid") {
    return {
      icon: ShieldX,
      iconClassName: "text-red-400",
      label: `Invalid approval · ${approval.label}`,
      detail: approval.reason ?? "The cryptographic evidence is invalid.",
      rowClassName: "bg-red-400/[0.035]",
      tone: "invalid",
    };
  }
  return {
    icon: ShieldQuestion,
    iconClassName: "text-amber-300/80",
    label: `Awaiting approval · ${approval.label}`,
    detail: approval.reason ?? "No valid signed attestation exists yet.",
    rowClassName: "bg-amber-400/[0.025]",
    tone: "unreviewed",
  };
}

function approvalCounts(
  evidence: SourceApprovalEvidence | undefined,
  entries: readonly SourceWorkspaceEntry[],
) {
  const counts = {
    approved: 0,
    invalid: 0,
    stale: 0,
    total: entries.length,
    unavailable: 0,
    unreviewed: 0,
  };
  for (const entry of entries) {
    const tone = approvalAppearance(evidence, evidence?.components[entry.id]).tone;
    counts[tone] += 1;
  }
  return counts;
}
