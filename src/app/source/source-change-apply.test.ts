import { expect, it, vi } from "vitest";

import type { AppliedSourceChangeSet, PreparedSourceChangeSet } from "../../shared/contracts";
import type { SourceDraftEntry } from "./source-draft-workspace";
import { applySourceDraftChanges, groupSourceDraftChanges } from "./source-change-apply";

it("groups app and development-library changes into separate repository transactions", () => {
  const changes = [entry("app", "app-root", "app-file"), entry("library-development", "ui-root", "ui-file")];
  expect(groupSourceDraftChanges(changes).map((group) => [group.scope, group.rootId, group.changes.length])).toEqual([
    ["app", "app-root", 1],
    ["library-development", "ui-root", 1],
  ]);
});

it("prepares every repository before applying any challenge", async () => {
  const calls: string[] = [];
  const execute = vi.fn(async (operation: { type: string; scope?: string; challengeId?: string }) => {
    calls.push(operation.type);
    if (operation.type === "prepare-source-change-set") {
      return prepared(operation.scope === "app" ? "app-challenge" : "library-challenge", operation.scope!);
    }
    return applied(operation.challengeId === "app-challenge" ? "app" : "library-development");
  });

  const result = await applySourceDraftChanges([
    entry("app", "app-root", "app-file"),
    entry("library-development", "ui-root", "ui-file"),
  ], execute as never);

  expect(calls).toEqual([
    "prepare-source-change-set",
    "prepare-source-change-set",
    "apply-source-change-set",
    "apply-source-change-set",
  ]);
  expect(result.map((item) => item.scope)).toEqual(["app", "library-development"]);
});

it("sends coordinated files from one root in one authoritative prepare", async () => {
  const execute = vi.fn(async (operation: { type: string; scope?: string; changes?: readonly unknown[] }) => (
    operation.type === "prepare-source-change-set"
      ? prepared("app-challenge", operation.scope!)
      : applied("app")
  ));

  await applySourceDraftChanges([
    entry("app", "app-root", "contract-file"),
    entry("app", "app-root", "consumer-file"),
  ], execute as never);

  expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
    type: "prepare-source-change-set",
    scope: "app",
    changes: [
      expect.objectContaining({ fileId: "contract-file" }),
      expect.objectContaining({ fileId: "consumer-file" }),
    ],
  }));
  expect(execute).toHaveBeenCalledTimes(2);
});

function entry(scope: SourceDraftEntry["scope"], rootId: string, fileId: string): SourceDraftEntry {
  return {
    scope,
    rootId,
    fileId,
    key: JSON.stringify([scope, rootId, fileId]),
    label: fileId,
    path: `src/${fileId}.tsx`,
    baseSource: "before",
    baseVersion: "0".repeat(64),
    draftSource: "after",
    draftDigest: "5:digest",
    history: [],
    future: [],
    validation: { state: "valid", draftDigest: "5:digest" },
    stale: { state: "current" },
    selectedForReview: true,
    updatedAt: 1,
    dirty: true,
    approved: true,
    approval: { draftDigest: "5:digest", approvedAt: 1 },
  };
}

function prepared(challengeId: string, scope: string): PreparedSourceChangeSet {
  return {
    state: "source-change-set-ready",
    challengeId,
    scope: scope as PreparedSourceChangeSet["scope"],
    changes: [],
    expiresAt: new Date().toISOString(),
  };
}

function applied(scope: AppliedSourceChangeSet["scope"]): AppliedSourceChangeSet {
  return { state: "source-change-set-applied", scope, changes: [] };
}
