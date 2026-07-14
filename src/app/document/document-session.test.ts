import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { StrictUiEvidence } from "../../shared/strict-ui";
import { createDocumentSession, documentSessionReducer, isDocumentDirty } from "./document-session";

const base: DesignDocument = {
  schemaVersion: 2,
  id: "screen.main",
  label: "Main",
  kind: "screen",
  root: { instanceId: "root", adapterId: "stack", slots: { content: [] } },
};

const versions = { "screen.source": "a".repeat(64) };

function evidence(documentDigest = "b".repeat(64)): StrictUiEvidence {
  return {
    id: "evidence.one",
    projectId: "demo",
    documentId: "screen.main",
    basis: { documentDigest, sourceVersion: "a".repeat(64), ruleSetVersion: "core.v1" },
    status: "passed",
    checkedAt: "2026-07-14T00:00:00.000Z",
    violations: [],
  };
}

describe("document session", () => {
  it("keeps edit history with undo and redo and invalidates evidence", () => {
    const initial = createDocumentSession(base, "a".repeat(64), versions);
    const draft = { ...base, label: "Dashboard" };
    const edited = documentSessionReducer(initial, { type: "edit", document: draft });
    expect(edited.phase).toBe("editing");
    expect(isDocumentDirty(edited)).toBe(true);
    const undone = documentSessionReducer(edited, { type: "undo" });
    expect(undone.draft).toBe(base);
    expect(undone.phase).toBe("ready");
    const redone = documentSessionReducer(undone, { type: "redo" });
    expect(redone.draft).toBe(draft);
  });

  it("treats a structurally restored document as clean", () => {
    const initial = createDocumentSession(base, "a".repeat(64), versions);
    const edited = documentSessionReducer(initial, {
      type: "edit",
      document: { ...base, label: "Temporary" },
    });
    const restored = documentSessionReducer(edited, {
      type: "edit",
      document: structuredClone(base),
    });

    expect(restored.phase).toBe("ready");
    expect(isDocumentDirty(restored)).toBe(false);
    expect(restored.past).toHaveLength(2);
  });

  it("only exposes a prepared diff when evidence matches the current document", () => {
    const draft = { ...base, label: "Dashboard" };
    const edited = documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), { type: "edit", document: draft });
    const checking = documentSessionReducer(edited, { type: "check-started", checkId: "check-one" });
    const prepared = documentSessionReducer(checking, {
      type: "prepare-succeeded",
      checkId: "check-one",
      evidence: evidence(),
      prepared: { challengeId: "challenge", documentDigest: "b".repeat(64), exactDiff: "diff", expiresAt: "later" },
    });
    expect(prepared.phase).toBe("diff-ready");
    expect(prepared.prepared?.exactDiff).toBe("diff");
    const changed = documentSessionReducer(prepared, { type: "edit", document: { ...draft, label: "Changed again" } });
    expect(changed.strictUi).toBeUndefined();
    expect(changed.prepared).toBeUndefined();
  });

  it("rejects a prepare result that finishes after a newer edit", () => {
    const draft = { ...base, label: "First" };
    const checking = documentSessionReducer(
      documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), { type: "edit", document: draft }),
      { type: "check-started", checkId: "check-first" },
    );
    const changed = documentSessionReducer(checking, { type: "edit", document: { ...base, label: "Second" } });
    const late = documentSessionReducer(changed, {
      type: "prepare-succeeded",
      checkId: "check-first",
      evidence: evidence(),
      prepared: { challengeId: "old-challenge", documentDigest: "b".repeat(64), exactDiff: "FIRST", expiresAt: "later" },
    });

    expect(late.phase).toBe("editing");
    expect(late.draft.label).toBe("Second");
    expect(late.prepared).toBeUndefined();
  });

  it("preserves a dirty draft when concurrent source changes make it stale", () => {
    const draft = { ...base, label: "My draft" };
    const edited = documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), { type: "edit", document: draft });
    const remote = { ...base, label: "Remote" };
    const stale = documentSessionReducer(edited, {
      type: "source-changed",
      document: remote,
      documentDigest: "c".repeat(64),
      sourceVersions: { "screen.source": "d".repeat(64) },
    });
    expect(stale.phase).toBe("stale");
    expect(stale.draft).toBe(draft);
    expect(documentSessionReducer(stale, { type: "reset" }).draft).toBe(remote);
  });

  it("reconciles a poll that observes the saved document before the save response", () => {
    const draft = { ...base, label: "Saved draft" };
    const checking = documentSessionReducer(
      documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), { type: "edit", document: draft }),
      { type: "check-started", checkId: "check-save" },
    );
    const prepared = documentSessionReducer(checking, {
      type: "prepare-succeeded",
      checkId: "check-save",
      evidence: evidence(),
      prepared: { challengeId: "challenge-save", documentDigest: "b".repeat(64), exactDiff: "diff", expiresAt: "later" },
    });
    const saving = documentSessionReducer(prepared, { type: "save-started", challengeId: "challenge-save" });
    const observedDocument = structuredClone(draft);
    const observed = documentSessionReducer(saving, {
      type: "source-changed",
      document: observedDocument,
      documentDigest: "b".repeat(64),
      sourceVersions: { "screen.source": "b".repeat(64) },
    });

    expect(observed).toMatchObject({
      phase: "saving",
      prepared: { challengeId: "challenge-save" },
      staleSnapshot: { document: observedDocument },
    });
    const saved = documentSessionReducer(observed, {
      type: "save-succeeded",
      challengeId: "challenge-save",
      documentDigest: "b".repeat(64),
      sourceVersions: { "screen.source": "b".repeat(64) },
    });
    expect(saved).toMatchObject({ phase: "saved", base: observedDocument, draft: observedDocument });
    expect(isDocumentDirty(saved)).toBe(false);
  });

  it("becomes stale when a save fails after polling observes a changed source", () => {
    const draft = { ...base, label: "My draft" };
    const remote = { ...base, label: "Remote source" };
    const checking = documentSessionReducer(
      documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), { type: "edit", document: draft }),
      { type: "check-started", checkId: "check-conflict" },
    );
    const prepared = documentSessionReducer(checking, {
      type: "prepare-succeeded",
      checkId: "check-conflict",
      evidence: evidence(),
      prepared: { challengeId: "challenge-conflict", documentDigest: "b".repeat(64), exactDiff: "diff", expiresAt: "later" },
    });
    const saving = documentSessionReducer(prepared, { type: "save-started", challengeId: "challenge-conflict" });
    const observed = documentSessionReducer(saving, {
      type: "source-changed",
      document: remote,
      documentDigest: "c".repeat(64),
      sourceVersions: { "screen.source": "c".repeat(64) },
    });
    const failed = documentSessionReducer(observed, { type: "save-failed", challengeId: "challenge-conflict" });

    expect(failed).toMatchObject({
      phase: "stale",
      draft,
      prepared: undefined,
      staleSnapshot: { document: remote },
    });
    expect(documentSessionReducer(failed, { type: "reset" }).draft).toBe(remote);
  });

  it("recovers from compile errors on the next edit", () => {
    const edited = documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), {
      type: "edit",
      document: { ...base, label: "Broken" },
    });
    const checking = documentSessionReducer(edited, { type: "check-started", checkId: "check-broken" });
    const failed = documentSessionReducer(checking, { type: "compile-failed", checkId: "check-broken", evidence: evidence(), message: "Compile failed" });
    expect(failed.phase).toBe("compile-error");
    const recovered = documentSessionReducer(failed, { type: "edit", document: { ...base, label: "Fixed" } });
    expect(recovered.phase).toBe("editing");
    expect(recovered.error).toBeUndefined();
  });

  it("returns failed checks and saves to an editable state", () => {
    const draft = { ...base, label: "Draft" };
    const edited = documentSessionReducer(createDocumentSession(base, "a".repeat(64), versions), { type: "edit", document: draft });
    const checking = documentSessionReducer(edited, { type: "check-started", checkId: "check-failure" });
    expect(documentSessionReducer(checking, { type: "check-failed", checkId: "check-failure" }).phase).toBe("editing");

    const prepared = documentSessionReducer(checking, {
      type: "prepare-succeeded",
      checkId: "check-failure",
      evidence: evidence(),
      prepared: { challengeId: "challenge", documentDigest: "b".repeat(64), exactDiff: "diff", expiresAt: "later" },
    });
    const saving = documentSessionReducer(prepared, { type: "save-started", challengeId: "challenge" });
    const failed = documentSessionReducer(saving, { type: "save-failed", challengeId: "challenge" });
    expect(failed.phase).toBe("editing");
    expect(failed.prepared).toBeUndefined();
  });
});
