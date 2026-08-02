import { expect, it, vi } from "vitest";

import { createMemorySourceDraftPersistence } from "./source-draft-persistence";
import {
  createSourceDraftWorkspace,
  sourceDraftDigest,
  sourceDraftKey,
} from "./source-draft-workspace";
import type {
  SourceDraftBase,
  SourceDraftLocation,
  SourceDraftPrepareResult,
} from "./source-draft-workspace-types";

const appRoot: SourceDraftLocation = { scope: "app", rootId: "/projects/app-a", fileId: "src/Button.tsx" };
const appSibling: SourceDraftLocation = { scope: "app", rootId: "/projects/app-a", fileId: "src/Card.tsx" };
const otherAppRoot: SourceDraftLocation = { scope: "app", rootId: "/projects/app-b", fileId: "src/Button.tsx" };
const libraryRoot: SourceDraftLocation = {
  scope: "library-development",
  rootId: "/projects/ui",
  fileId: "src/Button.tsx",
};

function base(location: SourceDraftLocation = appRoot, source = "export const Button = 1", version = "v1"): SourceDraftBase {
  return {
    ...location,
    label: "Button",
    path: location.fileId,
    baseSource: source,
    baseVersion: version,
  };
}

it("keys drafts by scope, root, and file so independent projects cannot collide", () => {
  expect(new Set([
    sourceDraftKey(appRoot),
    sourceDraftKey(otherAppRoot),
    sourceDraftKey(libraryRoot),
  ]).size).toBe(3);
});

it("preserves the base snapshot while editing and supports bounded undo and redo", async () => {
  const workspace = createSourceDraftWorkspace({ historyLimit: 2 });
  await workspace.hydrate();
  workspace.open(base());
  workspace.edit(appRoot, "draft 1");
  workspace.edit(appRoot, "draft 2");
  workspace.edit(appRoot, "draft 3");

  expect(workspace.get(appRoot)).toMatchObject({
    baseSource: "export const Button = 1",
    baseVersion: "v1",
    draftSource: "draft 3",
    dirty: true,
    history: ["draft 1", "draft 2"],
  });
  workspace.undo(appRoot);
  workspace.undo(appRoot);
  workspace.undo(appRoot);
  expect(workspace.get(appRoot)?.draftSource).toBe("draft 1");
  workspace.redo(appRoot);
  expect(workspace.get(appRoot)).toMatchObject({ draftSource: "draft 2", future: ["draft 3"] });
});

it("binds approval to the exact draft digest and clears it on every source mutation", async () => {
  let clock = 100;
  const workspace = createSourceDraftWorkspace({ now: () => clock++ });
  await workspace.hydrate();
  workspace.open(base());
  workspace.edit(appRoot, "approved draft");
  workspace.approve(appRoot);

  const approved = workspace.get(appRoot)!;
  expect(approved).toMatchObject({ approved: true, draftDigest: sourceDraftDigest("approved draft") });
  expect(approved.approval).toEqual({ draftDigest: approved.draftDigest, approvedAt: 102 });

  workspace.edit(appRoot, "changed draft");
  expect(workspace.get(appRoot)).toMatchObject({ approved: false, approval: undefined });
  workspace.undo(appRoot);
  expect(workspace.get(appRoot)).toMatchObject({ draftSource: "approved draft", approved: false, approval: undefined });
  workspace.redo(appRoot);
  workspace.approve(appRoot);
  workspace.reset(appRoot);
  expect(workspace.get(appRoot)).toMatchObject({ dirty: false, approved: false, approval: undefined });
});

it("keeps visual review evidence across a follow-up Monaco edit", async () => {
  const workspace = createSourceDraftWorkspace();
  await workspace.hydrate();
  workspace.open(base());
  workspace.edit(appRoot, "export const Button = () => <button className=\"p-2\" />;");
  workspace.setVisualReview(appRoot, { layerId: "button", previewEntryId: "button-design", className: "p-2", css: ".p-2{}" });

  expect(workspace.get(appRoot)?.visualReview).toEqual({ layerId: "button", previewEntryId: "button-design", className: "p-2", css: ".p-2{}" });

  workspace.edit(appRoot, "export const Button = () => <button className=\"p-2\" disabled />;");
  expect(workspace.get(appRoot)?.visualReview).toEqual({ layerId: "button", previewEntryId: "button-design", className: "p-2", css: ".p-2{}" });
});

it("tracks validation and stale state and only permits selected, valid, approved changes", async () => {
  const workspace = createSourceDraftWorkspace();
  await workspace.hydrate();
  workspace.open(base());
  workspace.edit(appRoot, "valid draft");
  workspace.approve(appRoot);
  expect(workspace.getSnapshot()).toMatchObject({ changeCount: 1, canApply: false });

  workspace.setValidation(appRoot, "valid");
  expect(workspace.getSnapshot().canApply).toBe(true);
  workspace.markStale(appRoot, "v2", "Changed on disk");
  expect(workspace.getSnapshot().canApply).toBe(false);
  expect(workspace.get(appRoot)?.stale).toEqual({ state: "stale", currentVersion: "v2", message: "Changed on disk" });
  workspace.clearStale(appRoot);
  expect(workspace.getSnapshot().canApply).toBe(true);
  workspace.setSelectedForReview(appRoot, false);
  expect(workspace.getSnapshot()).toMatchObject({ selectedChangeCount: 0, canApply: false });
});

it("combines app and library change counts while grouping review changes per root", async () => {
  const workspace = createSourceDraftWorkspace();
  await workspace.hydrate();
  for (const location of [appRoot, otherAppRoot, libraryRoot]) {
    workspace.open(base(location));
    workspace.edit(location, `draft for ${location.rootId}`);
    workspace.setValidation(location, "valid");
    workspace.approve(location);
  }
  workspace.setSelectedForReview(otherAppRoot, false);

  const state = workspace.getSnapshot();
  expect(state).toMatchObject({
    changeCount: 3,
    selectedChangeCount: 2,
    approvedChangeCount: 3,
    canApply: true,
  });
  expect(state.groups.map((group) => ({
    scope: group.scope,
    rootId: group.rootId,
    changeCount: group.changeCount,
    selected: group.selectedChangeCount,
  }))).toEqual([
    { scope: "app", rootId: "/projects/app-a", changeCount: 1, selected: 1 },
    { scope: "app", rootId: "/projects/app-b", changeCount: 1, selected: 0 },
    { scope: "library-development", rootId: "/projects/ui", changeCount: 1, selected: 1 },
  ]);
});

it("persists dirty drafts and review state, then restores them after a reload", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const first = createSourceDraftWorkspace({ persistence, now: () => 10 });
  await first.hydrate();
  first.open(base());
  first.edit(appRoot, "cached draft");
  first.setValidation(appRoot, "invalid", "Type error");
  first.approve(appRoot);
  first.setSelectedForReview(appRoot, false);
  await first.flush();

  expect(persistence.inspect()?.entries).toHaveLength(1);
  const second = createSourceDraftWorkspace({ persistence });
  await second.hydrate();
  expect(second.get(appRoot)).toMatchObject({
    baseSource: "export const Button = 1",
    baseVersion: "v1",
    draftSource: "cached draft",
    dirty: true,
    approved: true,
    selectedForReview: false,
    validation: { state: "invalid", message: "Type error" },
  });
});

it("merges drafts from independent workspace instances without replacing either tab's cache", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const first = createSourceDraftWorkspace({ persistence });
  const second = createSourceDraftWorkspace({ persistence });
  await Promise.all([first.hydrate(), second.hydrate()]);

  first.open(base(appRoot));
  first.edit(appRoot, "first tab draft");
  second.open(base(libraryRoot));
  second.edit(libraryRoot, "second tab draft");
  await Promise.all([first.flush(), second.flush()]);

  expect(second.get(appRoot)?.draftSource).toBe("first tab draft");
  expect(first.get(libraryRoot)?.draftSource).toBe("second tab draft");
  expect(persistence.inspect()?.entries.map((entry) => entry.draftSource).sort()).toEqual([
    "first tab draft",
    "second tab draft",
  ]);
  const reloaded = createSourceDraftWorkspace({ persistence });
  await reloaded.hydrate();
  expect(reloaded.get(appRoot)?.draftSource).toBe("first tab draft");
  expect(reloaded.get(libraryRoot)?.draftSource).toBe("second tab draft");
});

it("persists removals as keyed mutations so a stale tab cannot resurrect a discarded draft", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const first = createSourceDraftWorkspace({ persistence });
  const second = createSourceDraftWorkspace({ persistence });
  await Promise.all([first.hydrate(), second.hydrate()]);

  first.open(base(appRoot));
  first.edit(appRoot, "discard this draft");
  second.open(base(appSibling));
  second.edit(appSibling, "keep this draft");
  await Promise.all([first.flush(), second.flush()]);

  first.remove(appRoot);
  await first.flush();
  expect(second.get(appRoot)).toBeUndefined();
  second.edit(appSibling, "updated in the stale tab");
  await second.flush();

  const reloaded = createSourceDraftWorkspace({ persistence });
  await reloaded.hydrate();
  expect(reloaded.get(appRoot)).toBeUndefined();
  expect(reloaded.get(appSibling)?.draftSource).toBe("updated in the stale tab");
  expect(persistence.inspect()?.entries).toHaveLength(1);
});

it("rebases a newer cross-tab draft instead of clearing it when an older applied draft is acknowledged", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const applyingTab = createSourceDraftWorkspace({ persistence });
  const editingTab = createSourceDraftWorkspace({ persistence });
  await Promise.all([applyingTab.hydrate(), editingTab.hydrate()]);

  applyingTab.open(base());
  applyingTab.edit(appRoot, "reviewed draft");
  await applyingTab.flush();
  const applied = applyingTab.get(appRoot)!;

  editingTab.edit(appRoot, "newer draft from another tab");
  await editingTab.flush();
  expect(applyingTab.get(appRoot)?.draftSource).toBe("newer draft from another tab");

  applyingTab.acceptApplied(applied, {
    expectedBaseVersion: applied.baseVersion,
    expectedDraftDigest: applied.draftDigest,
    source: applied.draftSource,
    version: "v2",
  });
  await applyingTab.flush();

  for (const workspace of [applyingTab, editingTab]) {
    expect(workspace.get(appRoot)).toMatchObject({
      baseSource: "reviewed draft",
      baseVersion: "v2",
      draftSource: "newer draft from another tab",
      dirty: true,
      history: ["reviewed draft"],
      future: [],
      approval: undefined,
      validation: { state: "unvalidated", draftDigest: sourceDraftDigest("newer draft from another tab") },
      stale: { state: "current" },
    });
  }
  const reloaded = createSourceDraftWorkspace({ persistence });
  await reloaded.hydrate();
  expect(reloaded.get(appRoot)).toMatchObject({
    baseVersion: "v2",
    draftSource: "newer draft from another tab",
    dirty: true,
  });
});

it("revalidates a draft after reloading during an in-flight validation", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const first = createSourceDraftWorkspace({ persistence });
  await first.hydrate();
  first.open(base());
  first.edit(appRoot, "cached draft");
  first.setValidation(appRoot, "validating");
  await first.flush();

  const second = createSourceDraftWorkspace({ persistence });
  await second.hydrate();

  expect(second.get(appRoot)?.validation).toMatchObject({
    state: "unvalidated",
    draftDigest: sourceDraftDigest("cached draft"),
  });
});

it("keeps a recovered draft and marks it stale when the current base changed", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const first = createSourceDraftWorkspace({ persistence });
  await first.hydrate();
  first.open(base());
  first.edit(appRoot, "recovered draft");
  await first.flush();

  const second = createSourceDraftWorkspace({ persistence });
  second.open(base(appRoot, "new source", "v2"));
  await second.hydrate();
  expect(second.get(appRoot)).toMatchObject({
    baseSource: "export const Button = 1",
    baseVersion: "v1",
    draftSource: "recovered draft",
    stale: { state: "stale", currentVersion: "v2" },
  });
});

it("uses an injected source adapter for read and prepare without writing files", async () => {
  const prepare = vi.fn(async (): Promise<SourceDraftPrepareResult<{ challengeId: string }>> => ({
    state: "valid",
    prepared: { challengeId: "challenge" },
  }));
  const read = vi.fn(async () => base());
  const workspace = createSourceDraftWorkspace({ sourceAdapter: { read, prepare } });
  await workspace.hydrate();
  await workspace.readFromSource(appRoot);
  workspace.edit(appRoot, "prepared draft");
  const result = await workspace.prepare(appRoot);

  expect(read).toHaveBeenCalledWith(appRoot);
  expect(prepare).toHaveBeenCalledWith(expect.objectContaining({
    ...appRoot,
    baseVersion: "v1",
    draftSource: "prepared draft",
    draftDigest: sourceDraftDigest("prepared draft"),
  }));
  expect(result).toEqual({ state: "valid", prepared: { challengeId: "challenge" } });
  expect(workspace.get(appRoot)?.validation.state).toBe("valid");
});

it("does not let a late prepare result validate a newer draft", async () => {
  let resolve!: (result: SourceDraftPrepareResult<string>) => void;
  const pending = new Promise<SourceDraftPrepareResult<string>>((done) => { resolve = done; });
  const workspace = createSourceDraftWorkspace({
    sourceAdapter: { read: async () => base(), prepare: async () => pending },
  });
  await workspace.hydrate();
  workspace.open(base());
  workspace.edit(appRoot, "draft one");
  const preparing = workspace.prepare(appRoot);
  workspace.edit(appRoot, "draft two");
  resolve({ state: "valid", prepared: "old result" });
  await preparing;

  expect(workspace.get(appRoot)).toMatchObject({
    draftSource: "draft two",
    validation: { state: "unvalidated", draftDigest: sourceDraftDigest("draft two") },
  });
});

it("marks stale prepare failures and clears a cached draft after an applied snapshot", async () => {
  const persistence = createMemorySourceDraftPersistence();
  const workspace = createSourceDraftWorkspace({
    persistence,
    sourceAdapter: {
      read: async () => base(),
      prepare: async () => ({ state: "stale", currentVersion: "v2", message: "Outdated" }),
    },
  });
  await workspace.hydrate();
  workspace.open(base());
  workspace.edit(appRoot, "draft");
  await workspace.prepare(appRoot);
  expect(workspace.get(appRoot)).toMatchObject({
    stale: { state: "stale", currentVersion: "v2", message: "Outdated" },
    validation: { state: "invalid", message: "Outdated" },
  });

  const applied = workspace.get(appRoot)!;
  workspace.acceptApplied(appRoot, {
    expectedBaseVersion: applied.baseVersion,
    expectedDraftDigest: applied.draftDigest,
    source: applied.draftSource,
    version: "v3",
  });
  await workspace.flush();
  expect(workspace.get(appRoot)).toMatchObject({ dirty: false, baseVersion: "v3", approval: undefined });
  expect(persistence.inspect()?.entries).toEqual([]);
});
