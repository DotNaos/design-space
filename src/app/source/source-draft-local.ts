import type { PreparedSourceChangeSet, ProjectFileSnapshot, SourceDraftAnalysis } from "../../shared/contracts";
import { LocalOperationError, runLocalOperation } from "../api";
import { createIndexedDbSourceDraftPersistence, createMemorySourceDraftPersistence } from "./source-draft-persistence";
import { createSourceDraftWorkspace } from "./source-draft-workspace";
import { sourceDraftGroupId, sourceDraftKey } from "./source-draft-workspace";
import type {
  SourceDraftEntry,
  SourceDraftPrepareRequest,
  SourceDraftPrepareResult,
  SourceDraftSourceAdapter,
} from "./source-draft-workspace-types";

type LocalPreparedDraft = PreparedSourceChangeSet | SourceDraftAnalysis;

const preparedGroups = new Map<string, {
  challengeId: string;
  digests: ReadonlyMap<string, string>;
  expiresAt: number;
}>();

export function createLocalSourceDraftWorkspace() {
  return createSourceDraftWorkspace<LocalPreparedDraft>({
    persistence: typeof indexedDB === "undefined"
      ? createMemorySourceDraftPersistence()
      : createIndexedDbSourceDraftPersistence(),
    sourceAdapter: localSourceDraftAdapter,
  });
}

const localSourceDraftAdapter: SourceDraftSourceAdapter<LocalPreparedDraft> = {
  async read(location) {
    const snapshot = await runLocalOperation<ProjectFileSnapshot>({
      type: "read-project-file",
      fileId: location.fileId,
      scope: location.scope,
    });
    return {
      ...location,
      label: snapshot.label,
      path: snapshot.label,
      baseSource: snapshot.source,
      baseVersion: snapshot.version,
    };
  },
  async prepare(request): Promise<SourceDraftPrepareResult<SourceDraftAnalysis>> {
    try {
      const current = await runLocalOperation<ProjectFileSnapshot>({
        type: "read-project-file",
        fileId: request.fileId,
        scope: request.scope,
      });
      if (current.version !== request.baseVersion) {
        return { state: "stale", currentVersion: current.version, message: "The source changed after this draft was opened." };
      }
      const analysis = await runLocalOperation<SourceDraftAnalysis>({
        type: "analyze-source-file-draft",
        fileId: request.fileId,
        source: request.draftSource,
        scope: request.scope,
      });
      return { state: "valid", prepared: analysis };
    } catch (reason) {
      return {
        state: reason instanceof LocalOperationError && reason.code === "STALE_SOURCE" ? "stale" : "invalid",
        message: reason instanceof Error ? reason.message : "The source draft could not be validated.",
      };
    }
  },
  async prepareGroup(requests): Promise<SourceDraftPrepareResult<PreparedSourceChangeSet>> {
    try {
      prunePreparedGroups();
      const previous = preparedGroups.get(sourceDraftGroupId(requests[0]!));
      const prepared = await runLocalOperation<PreparedSourceChangeSet>({
        type: "prepare-source-change-set",
        scope: requests[0]!.scope,
        ...(previous ? { supersedesChallengeId: previous.challengeId } : {}),
        changes: requests.map((request) => ({
          fileId: request.fileId,
          baseVersion: request.baseVersion,
          source: request.draftSource,
        })),
      });
      rememberPreparedGroup(requests, prepared);
      return { state: "valid", prepared };
    } catch (reason) {
      return {
        state: reason instanceof LocalOperationError && reason.code === "STALE_SOURCE" ? "stale" : "invalid",
        message: reason instanceof Error ? reason.message : "The source change set could not be validated.",
      };
    }
  },
};

export function preparedSourceDraftModuleUrl(
  change: SourceDraftEntry,
  fileId: string,
  relativePath: string,
  groupChanges: readonly SourceDraftEntry[],
): string | undefined {
  if (!change.selectedForReview) return undefined;
  prunePreparedGroups();
  const prepared = preparedGroups.get(sourceDraftGroupId(change));
  if (!prepared || prepared.expiresAt <= Date.now()) return undefined;
  const current = groupChanges.filter((candidate) => (
    candidate.selectedForReview && sourceDraftGroupId(candidate) === sourceDraftGroupId(change)
  ));
  if (current.length !== prepared.digests.size || current.some((candidate) => (
    prepared.digests.get(sourceDraftKey(candidate)) !== candidate.draftDigest
  ))) return undefined;
  const extension = relativePath.split(/[?#]/, 1)[0]?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? ".js";
  return `/__design-space/source-preview/${encodeURIComponent(prepared.challengeId)}/${encodeURIComponent(fileId)}/module${extension}`;
}

function prunePreparedGroups(): void {
  const now = Date.now();
  for (const [groupId, prepared] of preparedGroups) {
    if (prepared.expiresAt <= now) preparedGroups.delete(groupId);
  }
}

function rememberPreparedGroup(
  requests: readonly SourceDraftPrepareRequest[],
  prepared: PreparedSourceChangeSet,
): void {
  const first = requests[0];
  if (!first) return;
  preparedGroups.set(sourceDraftGroupId(first), {
    challengeId: prepared.challengeId,
    digests: new Map(requests.map((request) => [sourceDraftKey(request), request.draftDigest])),
    expiresAt: Date.parse(prepared.expiresAt),
  });
}
