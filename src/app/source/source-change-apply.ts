import type {
  AppliedSourceChangeSet,
  BrowserOperation,
  PreparedSourceChangeSet,
} from "../../shared/contracts";
import type { SourceDraftEntry } from "./source-draft-workspace";

type ChangeSetOperation = Extract<BrowserOperation, { type: "prepare-source-change-set" | "apply-source-change-set" }>;
type ChangeSetResult = AppliedSourceChangeSet | PreparedSourceChangeSet;

export async function applySourceDraftChanges(
  changes: readonly SourceDraftEntry[],
  execute: <T extends ChangeSetResult>(operation: ChangeSetOperation) => Promise<T>,
): Promise<readonly AppliedSourceChangeSet[]> {
  const groups = groupSourceDraftChanges(changes);
  if (!groups.length) return [];

  const prepared: PreparedSourceChangeSet[] = [];
  for (const group of groups) {
    prepared.push(await execute<PreparedSourceChangeSet>({
      type: "prepare-source-change-set",
      scope: group.scope,
      changes: group.changes.map((change) => ({
        fileId: change.fileId,
        baseVersion: change.baseVersion,
        source: change.draftSource,
      })),
    }));
  }

  const applied: AppliedSourceChangeSet[] = [];
  for (const changeSet of prepared) {
    try {
      applied.push(await execute<AppliedSourceChangeSet>({
        type: "apply-source-change-set",
        challengeId: changeSet.challengeId,
      }));
    } catch (reason) {
      throw new SourceChangeApplyError(
        reason instanceof Error ? reason.message : "A repository change set could not be applied.",
        applied,
        reason,
      );
    }
  }
  return applied;
}

export class SourceChangeApplyError extends Error {
  constructor(
    message: string,
    readonly applied: readonly AppliedSourceChangeSet[],
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SourceChangeApplyError";
  }
}

export function groupSourceDraftChanges(changes: readonly SourceDraftEntry[]) {
  const groups = new Map<string, SourceDraftEntry[]>();
  for (const change of changes) {
    const id = JSON.stringify([change.scope, change.rootId]);
    groups.set(id, [...(groups.get(id) ?? []), change]);
  }
  return [...groups.values()].map((groupChanges) => ({
    scope: groupChanges[0]!.scope,
    rootId: groupChanges[0]!.rootId,
    changes: groupChanges,
  }));
}
