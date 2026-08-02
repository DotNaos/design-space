import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { sourceApprovalOperationSchema, type SignedSourceComponent } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import {
  sourceComponentApprovalScope,
  verifySourceComponentApprovals,
  type SourceApprovalStatusRunner,
} from "./source-approval-registration";
import type { OperationExecutor } from "./local-operation-service";
import type { RegisteredTarget } from "./target-registration";

const runFile = promisify(execFile);

export type SourceApprovalSignRunner = (input: {
  policy: string;
  root: string;
  scope: string;
  trustRoot: string;
}) => Promise<void>;

export interface SourceApprovalServiceOptions {
  sign?: SourceApprovalSignRunner;
  status?: SourceApprovalStatusRunner;
  trustRoot?: string;
}

export class SourceApprovalService implements OperationExecutor {
  readonly #target: RegisteredTarget;
  readonly #sign: SourceApprovalSignRunner;
  readonly #status?: SourceApprovalStatusRunner;
  readonly #trustRoot?: string;

  constructor(target: RegisteredTarget, options: SourceApprovalServiceOptions = {}) {
    this.#target = target;
    this.#sign = options.sign ?? runApprovalSign;
    this.#status = options.status;
    this.#trustRoot = options.trustRoot ?? process.env.PROJECT_APPROVAL_TRUST_ROOT?.trim();
  }

  async execute(input: unknown): Promise<SignedSourceComponent> {
    const parsed = sourceApprovalOperationSchema.safeParse(input);
    if (!parsed.success) throw new DesignSpaceError("INVALID_REQUEST", "The component signing request is invalid");
    const registration = this.#target.sourceApproval;
    const workspace = this.#target.sourceWorkspace;
    if (!registration || !workspace) {
      throw new DesignSpaceError("ACCESS_DENIED", "Component signing is not configured for this project");
    }
    if (!this.#trustRoot) {
      throw new DesignSpaceError("ACCESS_DENIED", "The external component approval trust root is unavailable");
    }
    const entry = workspace.manifest.entries.find((candidate) => candidate.id === parsed.data.entryId);
    if (!entry) throw new DesignSpaceError("NOT_FOUND", "The registered component no longer exists");

    try {
      await this.#sign({
        policy: registration.policy,
        root: this.#target.root,
        scope: sourceComponentApprovalScope(entry),
        trustRoot: this.#trustRoot,
      });
    } catch (error) {
      const detail = approvalCommandDetail(error);
      throw new DesignSpaceError(
        "TRANSACTION_FAILED",
        detail.includes("cancel") || detail.includes("auth")
          ? "Touch ID did not complete. This component was not signed."
          : "The component signature could not be created.",
      );
    }

    const approvals = await verifySourceComponentApprovals(
      this.#target.root,
      { project: this.#target.project, approvals: { policy: registration.policy } },
      workspace.manifest.entries,
      this.#status,
      this.#trustRoot,
    );
    if (approvals.status !== "verified" || approvals.components[entry.id]?.state !== "approved") {
      throw new DesignSpaceError(
        "TRANSACTION_FAILED",
        "The signature was created but could not be verified for this component.",
      );
    }
    return {
      state: "source-component-signed",
      entryId: entry.id,
      approvals,
    };
  }
}

async function runApprovalSign(input: {
  policy: string;
  root: string;
  scope: string;
  trustRoot: string;
}): Promise<void> {
  await runFile("project", [
    "approval",
    "sign",
    "--root",
    input.root,
    "--policy",
    input.policy,
    "--trust-root",
    input.trustRoot,
    "--scope",
    input.scope,
    "--format",
    "json",
  ], {
    cwd: input.root,
    maxBuffer: 1_048_576,
    timeout: 120_000,
  });
}

function approvalCommandDetail(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const candidate = error as { message?: unknown; stderr?: unknown };
  return `${typeof candidate.message === "string" ? candidate.message : ""} ${
    typeof candidate.stderr === "string" ? candidate.stderr : ""
  }`.toLocaleLowerCase();
}
