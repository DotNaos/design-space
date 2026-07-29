import { Tooltip } from "@heroui/react";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";

import type {
  SourceApprovalEvidence,
  SourceComponentApproval,
  SourceWorkspaceEntry,
} from "../../shared/source-workspace";

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
        className={`grid size-5 shrink-0 place-items-center ${appearance.className}`}
        role="img"
      >
        <Icon aria-hidden="true" size={13} />
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
) {
  if (!evidence || evidence.status === "not-configured") {
    return {
      icon: ShieldQuestion,
      className: "text-zinc-600",
      label: "Unreviewed · approvals not configured",
      detail: evidence?.reason ?? "This project has no cryptographic approval policy.",
    };
  }
  if (evidence.status === "unavailable") {
    return {
      icon: ShieldX,
      className: "text-red-400",
      label: "Approval verification unavailable",
      detail: evidence.reason ?? "The trusted verifier could not produce evidence.",
    };
  }
  if (!approval) {
    return {
      icon: ShieldQuestion,
      className: "text-zinc-600",
      label: "Unreviewed · no approval scope",
      detail: "The verified policy does not contain a scope for this component.",
    };
  }
  if (approval.state === "approved") {
    return {
      icon: ShieldCheck,
      className: "text-emerald-400",
      label: `Approved · ${approval.label}`,
      detail: approval.attestation,
    };
  }
  if (approval.state === "stale") {
    return {
      icon: ShieldAlert,
      className: "text-amber-300",
      label: `Changed after approval · ${approval.label}`,
      detail: approval.reason ?? "The signed content no longer matches the current component.",
    };
  }
  if (approval.state === "invalid") {
    return {
      icon: ShieldX,
      className: "text-red-400",
      label: `Invalid approval · ${approval.label}`,
      detail: approval.reason ?? "The cryptographic evidence is invalid.",
    };
  }
  return {
    icon: ShieldQuestion,
    className: "text-zinc-500",
    label: `Awaiting approval · ${approval.label}`,
    detail: approval.reason ?? "No valid signed attestation exists yet.",
  };
}
