import { designDocumentSchema, type DesignDocument } from "../../shared/design-document";

const storagePrefix = "design-space.document-draft.v2";

export interface StoredDocumentDraft {
  baseDocumentDigest: string;
  sourceVersions: Readonly<Record<string, string>>;
  document: DesignDocument;
  savedAt: string;
}

export function saveDocumentDraft(
  storage: Pick<Storage, "setItem">,
  projectId: string,
  value: StoredDocumentDraft,
): void {
  try {
    storage.setItem(storageKey(projectId, value.document.id), JSON.stringify(value));
  } catch {
    // In-memory editing must keep working when mobile browsers deny or exhaust storage.
  }
}

export function loadDocumentDraft(
  storage: Pick<Storage, "getItem">,
  projectId: string,
  documentId: string,
): StoredDocumentDraft | undefined {
  try {
    const source = storage.getItem(storageKey(projectId, documentId));
    if (!source) return undefined;
    const candidate = JSON.parse(source) as Partial<StoredDocumentDraft>;
    const parsed = designDocumentSchema.safeParse(candidate.document);
    if (
      !parsed.success ||
      parsed.data.id !== documentId ||
      typeof candidate.baseDocumentDigest !== "string" ||
      !candidate.sourceVersions ||
      typeof candidate.sourceVersions !== "object" ||
      typeof candidate.savedAt !== "string"
    ) return undefined;
    return {
      document: parsed.data,
      baseDocumentDigest: candidate.baseDocumentDigest,
      sourceVersions: Object.fromEntries(Object.entries(candidate.sourceVersions).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      savedAt: candidate.savedAt,
    };
  } catch {
    return undefined;
  }
}

export function clearDocumentDraft(
  storage: Pick<Storage, "removeItem">,
  projectId: string,
  documentId: string,
): void {
  try {
    storage.removeItem(storageKey(projectId, documentId));
  } catch {
    // Clearing recovery state is best effort and must never block the live editor.
  }
}

function storageKey(projectId: string, documentId: string): string {
  return `${storagePrefix}:${projectId}:${documentId}`;
}
