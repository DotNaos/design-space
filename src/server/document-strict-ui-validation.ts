import { canonicalJson } from "../shared/canonical-json";
import type { DesignDocument } from "../shared/design-document";
import { strictUiViolationSchema, type StrictUiViolation } from "../shared/strict-ui";
import { DesignSpaceError } from "./errors";
import { TrustedDocumentLibrary, type DocumentLibrarySnapshot } from "./document-library";
import type { DocumentTargetContext, RegisteredDocumentTarget } from "./target-registration";

export async function validateTargetStrictUi(
  target: RegisteredDocumentTarget,
  document: DesignDocument,
  context: DocumentTargetContext,
): Promise<readonly StrictUiViolation[]> {
  let violations: unknown = [];
  try {
    violations = await target.strictUi?.(structuredClone(document), context) ?? [];
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "Strict UI validation could not complete");
  }
  const parsed = strictUiViolationSchema.array().max(2_000).safeParse(violations);
  if (!parsed.success) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Strict UI validation returned invalid evidence");
  }
  return parsed.data;
}

export async function validateDependentDocuments(
  currentDocument: DesignDocument,
  proposedDocument: DesignDocument,
  snapshot: DocumentLibrarySnapshot,
  library: TrustedDocumentLibrary,
): Promise<readonly StrictUiViolation[]> {
  const violations: StrictUiViolation[] = [];
  for (const entry of snapshot.entries) {
    const otherDocuments = snapshot.documents.filter((candidate) => candidate.id !== entry.document.id);
    const baselineLibrary = [currentDocument, ...otherDocuments]
      .sort((left, right) => left.id.localeCompare(right.id, "en"));
    const proposedLibrary = [proposedDocument, ...otherDocuments]
      .sort((left, right) => left.id.localeCompare(right.id, "en"));
    const baseline = await validateTargetStrictUi(
      entry.target,
      entry.document,
      library.context(entry.target.id, entry.sources, baselineLibrary),
    );
    const proposed = await validateTargetStrictUi(
      entry.target,
      entry.document,
      library.context(entry.target.id, entry.sources, proposedLibrary),
    );
    const existing = new Set(baseline.map(violationKey));
    for (const violation of proposed) {
      if (existing.has(violationKey(violation))) continue;
      violations.push({
        ...violation,
        message: `Dependent ${entry.document.label}: ${violation.message}`.slice(0, 500),
        location: { kind: "document" },
      });
    }
  }
  if (violations.length > 2_000) {
    throw new DesignSpaceError("VALIDATION_ERROR", "Strict UI returned too many findings");
  }
  return violations;
}

function violationKey(violation: StrictUiViolation): string {
  return canonicalJson(violation);
}
