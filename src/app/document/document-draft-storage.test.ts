import { describe, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import {
  clearDocumentDraft,
  loadDocumentDraft,
  saveDocumentDraft,
  type StoredDocumentDraft,
} from "./document-draft-storage";

const document: DesignDocument = {
  schemaVersion: 2,
  id: "screen.main",
  label: "Main",
  kind: "screen",
  root: { instanceId: "root", adapterId: "stack", slots: { content: [] } },
};

const draft: StoredDocumentDraft = {
  document,
  baseDocumentDigest: "a".repeat(64),
  sourceVersions: { "screen.source": "b".repeat(64) },
  savedAt: "2026-07-14T00:00:00.000Z",
};

describe("document draft storage", () => {
  it("round-trips a valid draft", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    saveDocumentDraft(storage, "demo", draft);
    expect(loadDocumentDraft(storage, "demo", document.id)).toEqual(draft);
    clearDocumentDraft(storage, "demo", document.id);
    expect(loadDocumentDraft(storage, "demo", document.id)).toBeUndefined();
  });

  it("keeps editing safe when Safari storage operations throw", () => {
    const error = new DOMException("Storage is unavailable", "SecurityError");
    const storage = {
      getItem: vi.fn(() => { throw error; }),
      setItem: vi.fn(() => { throw error; }),
      removeItem: vi.fn(() => { throw error; }),
    };

    expect(() => saveDocumentDraft(storage, "demo", draft)).not.toThrow();
    expect(loadDocumentDraft(storage, "demo", document.id)).toBeUndefined();
    expect(() => clearDocumentDraft(storage, "demo", document.id)).not.toThrow();
  });
});
