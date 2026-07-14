import { designDocumentSchema, type DesignDocument } from "../shared/design-document";
import { DesignSpaceError } from "./errors";
import type { DocumentTargetContext, RegisteredDocumentTarget } from "./target-registration";

export async function loadRegisteredDocument(
  target: RegisteredDocumentTarget,
  sources: Readonly<Record<string, string>>,
  context: DocumentTargetContext,
): Promise<DesignDocument> {
  let loaded: unknown;
  try {
    loaded = await target.load(sources, context);
  } catch {
    throw new DesignSpaceError("INVALID_DOCUMENT", "The registered document could not be loaded");
  }
  const parsed = designDocumentSchema.safeParse(loaded);
  if (!parsed.success || parsed.data.id !== target.id) {
    throw new DesignSpaceError("INVALID_DOCUMENT", "The registered document has an invalid shape or identity");
  }
  return parsed.data;
}
