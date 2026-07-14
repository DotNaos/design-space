import { describe, expect, it } from "vitest";
import { editorReducer } from "./reducer";
import { createEditorState, isDirty } from "./state";

describe("editor lifecycle", () => {
  it("keeps a live draft separate from saved source and exposes an exact prepared diff", () => {
    const initial = createEditorState("p-4 bg-white", "v1");
    const edited = editorReducer(initial, { type: "edit", value: "p-6 bg-white" });
    expect(edited).toMatchObject({
      phase: "draft-editing",
      savedValue: "p-4 bg-white",
      draftValue: "p-6 bg-white",
    });
    expect(isDirty(edited)).toBe(true);

    const prepared = editorReducer(edited, {
      type: "prepare-succeeded",
      preparedEditId: "prepared-1",
      sourceVersion: "v1",
      draftValue: "p-6 bg-white",
      exactDiff: "- p-4 bg-white\n+ p-6 bg-white",
    });
    expect(prepared.phase).toBe("diff-ready");
    expect(prepared.preparedEdit?.exactDiff).toContain("+ p-6 bg-white");

    const saving = editorReducer(prepared, { type: "save-started", preparedEditId: "prepared-1" });
    expect(saving.phase).toBe("saving");
    const saved = editorReducer(saving, {
      type: "save-succeeded",
      preparedEditId: "prepared-1",
      savedValue: "p-6 bg-white",
      sourceVersion: "v2",
    });
    expect(saved).toEqual({
      phase: "saved",
      savedValue: "p-6 bg-white",
      draftValue: "p-6 bg-white",
      sourceVersion: "v2",
      undoStack: [],
    });
    expect(editorReducer(saved, { type: "preview-ready" }).phase).toBe("preview-ready");
  });

  it("supports multi-step undo and reset without mutating saved source", () => {
    const initial = createEditorState("gap-2", "v1");
    const first = editorReducer(initial, { type: "edit", value: "gap-4" });
    const second = editorReducer(first, { type: "edit", value: "gap-8" });
    const undone = editorReducer(second, { type: "undo" });
    expect(undone).toMatchObject({ phase: "draft-editing", draftValue: "gap-4", savedValue: "gap-2" });
    const reset = editorReducer(undone, { type: "reset" });
    expect(reset).toMatchObject({ phase: "preview-ready", draftValue: "gap-2", savedValue: "gap-2" });
    expect(reset.undoStack).toHaveLength(0);
  });

  it("ignores save responses that do not match the prepared edit", () => {
    const edited = editorReducer(createEditorState("old", "v1"), { type: "edit", value: "new" });
    const prepared = editorReducer(edited, {
      type: "prepare-succeeded",
      preparedEditId: "right",
      sourceVersion: "v1",
      draftValue: "new",
      exactDiff: "diff",
    });
    const unchanged = editorReducer(prepared, {
      type: "save-succeeded",
      preparedEditId: "wrong",
      savedValue: "attacker-controlled",
      sourceVersion: "v2",
    });
    expect(unchanged).toBe(prepared);
  });

  it("does not enter saving before the current draft has a prepared diff", () => {
    const edited = editorReducer(createEditorState("old", "v1"), { type: "edit", value: "new" });
    expect(editorReducer(edited, { type: "save-started", preparedEditId: "missing" })).toBe(edited);
  });

  it("keeps a prepared diff retryable after saving fails", () => {
    const edited = editorReducer(createEditorState("old", "v1"), { type: "edit", value: "new" });
    const prepared = editorReducer(edited, {
      type: "prepare-succeeded",
      preparedEditId: "prepared-retry",
      sourceVersion: "v1",
      draftValue: "new",
      exactDiff: "- old\n+ new",
    });
    const saving = editorReducer(prepared, { type: "save-started", preparedEditId: "prepared-retry" });
    const failed = editorReducer(saving, { type: "save-failed", preparedEditId: "prepared-retry" });

    expect(failed).toMatchObject({
      phase: "diff-ready",
      draftValue: "new",
      preparedEdit: { id: "prepared-retry", exactDiff: "- old\n+ new" },
    });
    expect(editorReducer(failed, { type: "save-started", preparedEditId: "prepared-retry" }).phase).toBe("saving");
  });
});

describe("source conflicts", () => {
  it("accepts concurrent source changes when no draft exists", () => {
    const refreshed = editorReducer(createEditorState("p-4", "v1"), {
      type: "source-changed",
      value: "p-6",
      sourceVersion: "v2",
    });
    expect(refreshed).toMatchObject({
      phase: "preview-ready",
      savedValue: "p-6",
      draftValue: "p-6",
      sourceVersion: "v2",
    });
  });

  it("marks dirty or prepared edits stale and preserves the user's draft", () => {
    const edited = editorReducer(createEditorState("p-4", "v1"), { type: "edit", value: "p-8" });
    const prepared = editorReducer(edited, {
      type: "prepare-succeeded",
      preparedEditId: "edit-1",
      sourceVersion: "v1",
      draftValue: "p-8",
      exactDiff: "diff",
    });
    const stale = editorReducer(prepared, {
      type: "source-changed",
      value: "p-6",
      sourceVersion: "v2",
    });
    expect(stale).toMatchObject({
      phase: "stale",
      savedValue: "p-4",
      draftValue: "p-8",
      staleSource: { value: "p-6", version: "v2" },
      preparedEdit: undefined,
    });

    const revisedStaleDraft = editorReducer(stale, { type: "edit", value: "p-10" });
    expect(revisedStaleDraft).toMatchObject({ phase: "stale", draftValue: "p-10" });
    expect(editorReducer(revisedStaleDraft, {
      type: "prepare-succeeded",
      preparedEditId: "must-not-prepare",
      sourceVersion: "v1",
      draftValue: "p-10",
      exactDiff: "unsafe",
    })).toBe(revisedStaleDraft);

    const reset = editorReducer(stale, { type: "reset" });
    expect(reset).toMatchObject({
      phase: "preview-ready",
      savedValue: "p-6",
      draftValue: "p-6",
      sourceVersion: "v2",
    });
  });

  it("rejects a prepared diff computed against an outdated version", () => {
    const edited = editorReducer(createEditorState("old", "v2"), { type: "edit", value: "mine" });
    const stale = editorReducer(edited, {
      type: "prepare-succeeded",
      preparedEditId: "old-preparation",
      sourceVersion: "v1",
      draftValue: "mine",
      exactDiff: "outdated",
    });
    expect(stale.phase).toBe("stale");
    expect(stale.preparedEdit).toBeUndefined();
  });
});

describe("compile error recovery", () => {
  it("preserves the draft on compile failure and recovers on the next edit", () => {
    const edited = editorReducer(createEditorState("grid", "v1"), { type: "edit", value: "grid broken-[" });
    const failed = editorReducer(edited, {
      type: "compile-failed",
      message: "Target preview failed to compile",
      diagnostics: ["Unclosed bracket"],
    });
    expect(failed).toMatchObject({
      phase: "compile-error",
      draftValue: "grid broken-[",
      compileFailure: { message: "Target preview failed to compile" },
    });

    const recovered = editorReducer(failed, { type: "edit", value: "grid" });
    expect(recovered).toMatchObject({
      phase: "preview-ready",
      draftValue: "grid",
      compileFailure: undefined,
    });
  });

  it("recovers to the last saved source when reset is chosen", () => {
    const failed = editorReducer(
      editorReducer(createEditorState("flex", "v1"), { type: "edit", value: "invalid" }),
      { type: "compile-failed", message: "Compile failed" },
    );
    expect(editorReducer(failed, { type: "reset" })).toMatchObject({
      phase: "preview-ready",
      draftValue: "flex",
      compileFailure: undefined,
    });
  });

  it("ignores a prepared response for an older draft", () => {
    const firstDraft = editorReducer(createEditorState("p-4", "v1"), { type: "edit", value: "p-6" });
    const latestDraft = editorReducer(firstDraft, { type: "edit", value: "p-8" });
    const result = editorReducer(latestDraft, {
      type: "prepare-succeeded",
      preparedEditId: "old-draft",
      sourceVersion: "v1",
      draftValue: "p-6",
      exactDiff: "old diff",
    });
    expect(result).toEqual(latestDraft);
  });
});
