import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod";

import type {
  DesignSpaceProjectConfig,
  SourceApprovalEvidence,
  SourceApprovalState,
  SourceWorkspaceEntry,
} from "../shared/source-workspace";

const runFile = promisify(execFile);
const defaultPolicy = ".project/approvals/policy.yaml";
const approvalState = z.enum(["approved", "missing", "stale", "invalid"]);
const approvalReport = z.object({
  repository: z.string(),
  policyId: z.string(),
  ok: z.boolean(),
  scopes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    state: approvalState,
    attestation: z.string(),
    reason: z.string().optional(),
  })),
});

export type SourceApprovalStatusRunner = (input: {
  policy: string;
  root: string;
  trustRoot: string;
}) => Promise<unknown>;

export function sourceComponentApprovalScope(entry: SourceWorkspaceEntry): string {
  return `component:${entry.relativePath}#${entry.exportName}`;
}

export async function verifySourceComponentApprovals(
  root: string,
  config: DesignSpaceProjectConfig,
  entries: readonly SourceWorkspaceEntry[],
  run: SourceApprovalStatusRunner = runApprovalStatus,
): Promise<SourceApprovalEvidence> {
  if (!config.approvals) {
    return {
      status: "not-configured",
      reason: "Cryptographic component approvals are not configured for this project.",
      components: {},
    };
  }
  const trustRoot = process.env.PROJECT_APPROVAL_TRUST_ROOT?.trim();
  if (!trustRoot) {
    return {
      status: "unavailable",
      reason: "PROJECT_APPROVAL_TRUST_ROOT is required to verify component approvals.",
      components: {},
    };
  }
  try {
    const report = approvalReport.parse(await run({
      root,
      policy: config.approvals.policy ?? defaultPolicy,
      trustRoot,
    }));
    const scopes = new Map(report.scopes.map((scope) => [scope.id, scope]));
    const components = Object.fromEntries(entries.flatMap((entry) => {
      const scope = scopes.get(sourceComponentApprovalScope(entry));
      if (!scope) return [];
      return [[entry.id, {
        scopeId: scope.id,
        label: scope.label,
        state: scope.state as SourceApprovalState,
        attestation: scope.attestation,
        ...(scope.reason ? { reason: scope.reason } : {}),
      }]];
    }));
    return {
      status: "verified",
      policyId: report.policyId,
      components,
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : "Component approval verification failed.",
      components: {},
    };
  }
}

async function runApprovalStatus(input: {
  policy: string;
  root: string;
  trustRoot: string;
}): Promise<unknown> {
  const result = await runFile("project", [
    "approval",
    "status",
    "--root",
    input.root,
    "--policy",
    input.policy,
    "--trust-root",
    input.trustRoot,
    "--format",
    "json",
  ], {
    cwd: input.root,
    maxBuffer: 1_048_576,
    timeout: 10_000,
  });
  return JSON.parse(result.stdout);
}
