import type {
  CompileBlockedDocumentSave,
  SourceVersionMap,
} from "../shared/document-transactions";
import {
  strictUiEvidenceSchema,
  strictUiStatus,
  type StrictUiEvidence,
  type StrictUiViolation,
} from "../shared/strict-ui";
import { sourceSetVersion } from "./document-service-values";

interface StrictUiEvidenceInput {
  createId: () => string;
  projectId: string;
  registrationVersion: string;
  documentId: string;
  documentDigest: string;
  sourceVersions: SourceVersionMap;
  violations: readonly StrictUiViolation[];
  checkedAt: string;
}

export type StrictUiEvidenceContext = Pick<
  StrictUiEvidenceInput,
  "createId" | "projectId" | "registrationVersion"
>;

export function createStrictUiEvidence(input: StrictUiEvidenceInput): StrictUiEvidence {
  return strictUiEvidenceSchema.parse({
    id: `evidence-${input.createId()}`,
    projectId: input.projectId,
    documentId: input.documentId,
    basis: {
      documentDigest: input.documentDigest,
      sourceVersion: sourceSetVersion(input.sourceVersions),
      ruleSetVersion: input.registrationVersion,
    },
    status: strictUiStatus(input.violations),
    checkedAt: input.checkedAt,
    violations: input.violations,
  });
}

export function createCompileBlocked(
  input: StrictUiEvidenceInput & { message: string; now: () => number },
): CompileBlockedDocumentSave {
  return {
    state: "compile-blocked",
    documentId: input.documentId,
    documentDigest: input.documentDigest,
    strictUi: createStrictUiEvidence(input),
    compile: {
      status: "failed",
      checkedAt: new Date(input.now()).toISOString(),
      message: input.message,
    },
  };
}
