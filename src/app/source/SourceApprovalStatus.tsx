import { Tooltip } from "@heroui/react";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";

import type {
  SourceApprovalEvidence,
  SourceComponentApproval,
  SourceWorkspaceEntry,
} from "../../shared/source-workspace";

type ApprovalTone = "approved" | "invalid" | "stale" | "unreviewed" | "unavailable";

interface ApprovalAppearance {
  badgeClassName: string;
  detail: string;
  icon: typeof ShieldCheck;
  label: string;
  rowClassName: string;
  shortLabel: string;
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
  const configured = props.approvals?.status === "verified";
  const unavailable = props.approvals?.status === "unavailable";
  return (
    <section
      aria-label="Approval review"
      className="shrink-0 border-b border-emerald-400/15 bg-emerald-500/[0.055] px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck aria-hidden="true" className="text-emerald-300" size={15} />
        <p className="text-[11px] font-semibold text-emerald-100">Approval review</p>
        <p className="ml-auto font-mono text-[10px] tabular-nums text-emerald-300">
          {counts.approved} / {counts.total} approved
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-medium uppercase tracking-[0.08em]">
        {counts.approved > 0 && <span className="text-emerald-400">{counts.approved} approved</span>}
        {counts.stale > 0 && <span className="text-amber-300">{counts.stale} changed</span>}
        {counts.invalid > 0 && <span className="text-red-400">{counts.invalid} invalid</span>}
        {counts.unreviewed > 0 && <span className="text-amber-300">{counts.unreviewed} unreviewed</span>}
        {counts.unavailable > 0 && <span className="text-red-400">{counts.unavailable} unavailable</span>}
      </div>
      {!configured && (
        <p className={`mt-1.5 text-[9px] leading-4 ${unavailable ? "text-red-300/80" : "text-amber-200/70"}`}>
          {props.approvals?.reason ?? "Cryptographic component approvals are not configured."}
        </p>
      )}
    </section>
  );
}

export function sourceApprovalRowClassName(
  approvals: SourceApprovalEvidence | undefined,
  entry: SourceWorkspaceEntry,
): string {
  return approvalAppearance(approvals, approvals?.components[entry.id]).rowClassName;
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
        className={`inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[8px] font-semibold uppercase tracking-[0.06em] ${appearance.badgeClassName}`}
        role="img"
      >
        <Icon aria-hidden="true" size={10} />
        <span>{appearance.shortLabel}</span>
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

function approvalAppearance(
  evidence: SourceApprovalEvidence | undefined,
  approval: SourceComponentApproval | undefined,
): ApprovalAppearance {
  if (!evidence || evidence.status === "not-configured") {
    return {
      icon: ShieldQuestion,
      badgeClassName: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20",
      label: "Unreviewed · approvals not configured",
      detail: evidence?.reason ?? "This project has no cryptographic approval policy.",
      rowClassName: "bg-amber-400/[0.035]",
      shortLabel: "Unreviewed",
      tone: "unreviewed",
    };
  }
  if (evidence.status === "unavailable") {
    return {
      icon: ShieldX,
      badgeClassName: "bg-red-400/10 text-red-300 ring-1 ring-inset ring-red-400/25",
      label: "Approval verification unavailable",
      detail: evidence.reason ?? "The trusted verifier could not produce evidence.",
      rowClassName: "bg-red-400/[0.045]",
      shortLabel: "Unavailable",
      tone: "unavailable",
    };
  }
  if (!approval) {
    return {
      icon: ShieldQuestion,
      badgeClassName: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20",
      label: "Unreviewed · no approval scope",
      detail: "The verified policy does not contain a scope for this component.",
      rowClassName: "bg-amber-400/[0.035]",
      shortLabel: "Unreviewed",
      tone: "unreviewed",
    };
  }
  if (approval.state === "approved") {
    return {
      icon: ShieldCheck,
      badgeClassName: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20",
      label: `Approved · ${approval.label}`,
      detail: approval.attestation,
      rowClassName: "bg-emerald-400/[0.04]",
      shortLabel: "Approved",
      tone: "approved",
    };
  }
  if (approval.state === "stale") {
    return {
      icon: ShieldAlert,
      badgeClassName: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25",
      label: `Changed after approval · ${approval.label}`,
      detail: approval.reason ?? "The signed content no longer matches the current component.",
      rowClassName: "bg-amber-400/[0.045]",
      shortLabel: "Changed",
      tone: "stale",
    };
  }
  if (approval.state === "invalid") {
    return {
      icon: ShieldX,
      badgeClassName: "bg-red-400/10 text-red-300 ring-1 ring-inset ring-red-400/25",
      label: `Invalid approval · ${approval.label}`,
      detail: approval.reason ?? "The cryptographic evidence is invalid.",
      rowClassName: "bg-red-400/[0.045]",
      shortLabel: "Invalid",
      tone: "invalid",
    };
  }
  return {
    icon: ShieldQuestion,
    badgeClassName: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20",
    label: `Awaiting approval · ${approval.label}`,
    detail: approval.reason ?? "No valid signed attestation exists yet.",
    rowClassName: "bg-amber-400/[0.035]",
    shortLabel: "Awaiting",
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
