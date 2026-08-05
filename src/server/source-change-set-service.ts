import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import ts from "typescript";
import { transformWithEsbuild } from "vite";

import type {
  AppliedSourceChangeSet,
  PreparedSourceChangeSet,
  SourceChangeReviewEvidence,
} from "../shared/contracts";
import type { SourceDesignScope } from "../shared/source-design";
import { commitFileTransaction, type FileTransactionHooks } from "./atomic-file-transaction";
import { ChallengeStore } from "./challenge-store";
import { createUnifiedDiff } from "./diff";
import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";
import { readRegisteredFile } from "./registered-file-reader";
import type { IndexedSourceWorkspace } from "./source-file-index";
import { sourceVersion } from "./source-editor";
import type { SourceDraftPreviewRegistry } from "./source-draft-preview-registry";
import { assertStrictUiSourceChangesDoNotRegress } from "./strict-ui-source-validation";
import type { RegisteredFile, RegisteredTarget } from "./target-registration";

const maximumSourceBytes = 512 * 1024;
const defaultChallengeTtlMs = 30 * 60 * 1_000;

export interface SourceChangeInput {
  fileId: string;
  baseVersion: string;
  source: string;
}

interface StoredSourceChange {
  file: RegisteredFile;
  baseVersion: string;
  nextVersion: string;
  nextSource: string;
}

interface StoredSourceChangeSet {
  id: string;
  scope: SourceDesignScope;
  root: string;
  changes: readonly StoredSourceChange[];
  expiresAt: number;
}

export interface SourceChangeSetServiceOptions {
  challengeTtlMs?: number;
  maximumLiveChallenges?: number;
  now?: () => number;
  createId?: () => string;
  transactionHooks?: FileTransactionHooks;
  previewRegistry?: SourceDraftPreviewRegistry;
}

export class SourceChangeSetService {
  readonly #target: RegisteredTarget;
  readonly #challenges: ChallengeStore<StoredSourceChangeSet>;
  readonly #challengeTtlMs: number;
  readonly #now: () => number;
  readonly #createId: () => string;
  readonly #transactionHooks: FileTransactionHooks;
  readonly #previewRegistry?: SourceDraftPreviewRegistry;
  #applyQueue: Promise<void> = Promise.resolve();

  constructor(target: RegisteredTarget, options: SourceChangeSetServiceOptions = {}) {
    this.#target = target;
    this.#challengeTtlMs = options.challengeTtlMs ?? defaultChallengeTtlMs;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? randomUUID;
    this.#transactionHooks = options.transactionHooks ?? {};
    this.#previewRegistry = options.previewRegistry;
    this.#challenges = new ChallengeStore({ maximumLive: options.maximumLiveChallenges, now: this.#now });
  }

  async prepare(
    scope: SourceDesignScope,
    unsafeChanges: readonly SourceChangeInput[],
    supersedesChallengeId?: string,
  ): Promise<PreparedSourceChangeSet> {
    if (unsafeChanges.length < 1 || unsafeChanges.length > 50) {
      throw new DesignSpaceError("INVALID_REQUEST", "A source change set must contain between one and 50 files");
    }
    const ids = unsafeChanges.map((change) => change.fileId);
    if (new Set(ids).size !== ids.length) {
      throw new DesignSpaceError("INVALID_REQUEST", "A source change set cannot edit the same file twice");
    }

    const workspace = this.#workspace(scope);
    const stored: StoredSourceChange[] = [];
    const evidence: SourceChangeReviewEvidence[] = [];
    for (const change of unsafeChanges) {
      if (Buffer.byteLength(change.source, "utf8") > maximumSourceBytes) {
        throw new DesignSpaceError("INVALID_REQUEST", "A source draft is too large");
      }
      const file = this.#resolveEditableFile(scope, workspace, change.fileId);
      const beforeSource = await readRegisteredFile(workspace.root, file.path, {
        maximumBytes: maximumSourceBytes,
        unavailableMessage: "A registered source is unavailable for change-set review",
      });
      if (sourceVersion(beforeSource) !== change.baseVersion) {
        throw new DesignSpaceError("STALE_SOURCE", "A source changed after the draft was created");
      }
      if (beforeSource === change.source) {
        throw new DesignSpaceError("INVALID_REQUEST", "A source change set contains an unchanged file");
      }
      stored.push({
        file,
        baseVersion: change.baseVersion,
        nextVersion: sourceVersion(change.source),
        nextSource: change.source,
      });
      evidence.push({
        changeId: file.id,
        fileId: file.id,
        label: file.displayName,
        baseVersion: change.baseVersion,
        nextVersion: sourceVersion(change.source),
        beforeSource,
        afterSource: change.source,
        diff: createUnifiedDiff(beforeSource, change.source, file.displayName),
      });
    }

    await assertDraftsCompile(workspace.root, stored);
    await assertStrictUiSourceChangesDoNotRegress({
      projectRoot: workspace.root,
      filePaths: workspace.files
        .filter((file) => /\.[cm]?tsx?$/.test(file.absolutePath))
        .map((file) => file.absolutePath),
      changes: stored.map((change) => ({
        filePath: change.file.path,
        source: change.nextSource,
      })),
    });
    const challengeId = this.#createId();
    const expiresAt = this.#now() + this.#challengeTtlMs;
    const superseded = supersedesChallengeId
      ? this.#challenges.remove(supersedesChallengeId, (challenge) => (
        challenge.scope === scope && challenge.root === workspace.root
      ))
      : false;
    if (superseded && supersedesChallengeId) this.#previewRegistry?.remove(supersedesChallengeId);
    this.#challenges.set(challengeId, {
      id: challengeId,
      scope,
      root: workspace.root,
      changes: stored,
      expiresAt,
    });
    this.#previewRegistry?.register({
      challengeId,
      scope,
      workspace,
      changes: stored.map((change) => ({ fileId: change.file.id, source: change.nextSource })),
      expiresAt,
    });
    return {
      state: "source-change-set-ready",
      challengeId,
      scope,
      changes: Object.freeze(evidence),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  apply(challengeId: string): Promise<AppliedSourceChangeSet> {
    const pending = this.#applyQueue.then(() => this.#applyNow(challengeId));
    this.#applyQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async #applyNow(challengeId: string): Promise<AppliedSourceChangeSet> {
    const challenge = this.#challenges.take(challengeId);
    this.#previewRegistry?.remove(challengeId);
    if (!challenge) throw new DesignSpaceError("NOT_FOUND", "The prepared source change set does not exist");
    if (challenge.expiresAt <= this.#now()) {
      throw new DesignSpaceError("CHALLENGE_EXPIRED", "The prepared source change set expired before it was applied");
    }
    await commitFileTransaction(challenge.root, challenge.changes.map((change) => ({
      file: change.file,
      expectedVersion: change.baseVersion,
      nextSource: change.nextSource,
    })), this.#transactionHooks);
    await Promise.all(challenge.changes.map((change) => assertStillRegistered(challenge.root, change.file.path)));
    return {
      state: "source-change-set-applied",
      scope: challenge.scope,
      changes: challenge.changes.map((change) => ({
        changeId: change.file.id,
        fileId: change.file.id,
        label: change.file.displayName,
        previousVersion: change.baseVersion,
        version: change.nextVersion,
      })),
    };
  }

  #workspace(scope: SourceDesignScope): IndexedSourceWorkspace {
    const workspace = scope === "app"
      ? this.#target.sourceWorkspace
      : this.#target.sourceLibrary?.development;
    if (!workspace) {
      throw new DesignSpaceError("ACCESS_DENIED", scope === "app"
        ? "This project has no editable source workspace"
        : "The development library source is not attached");
    }
    return workspace;
  }

  #resolveEditableFile(
    scope: SourceDesignScope,
    workspace: IndexedSourceWorkspace,
    fileId: string,
  ): RegisteredFile {
    const indexed = workspace.files.find((candidate) => candidate.id === fileId);
    if (!indexed) throw new DesignSpaceError("NOT_FOUND", "The source file is not registered in this scope");
    if (!/^(?:app|src)\//.test(indexed.relativePath) || !/\.[cm]?tsx?$/.test(indexed.relativePath)) {
      throw new DesignSpaceError("ACCESS_DENIED", "Only registered TypeScript source files can be changed");
    }
    if (scope === "app" && !this.#target.editableFileIds?.has(fileId)) {
      throw new DesignSpaceError("ACCESS_DENIED", "The project source is not registered for editing");
    }
    return { id: indexed.id, path: indexed.absolutePath, displayName: indexed.relativePath };
  }
}

async function assertDraftsCompile(root: string, changes: readonly StoredSourceChange[]): Promise<void> {
  for (const change of changes) {
    try {
      const loader = /\.tsx$/.test(change.file.displayName) ? "tsx" : "ts";
      await transformWithEsbuild(change.nextSource, change.file.displayName, { loader, jsx: "automatic" });
    } catch {
      throw new DesignSpaceError("COMPILE_ERROR", "A source draft contains invalid TypeScript syntax");
    }
  }

  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return;
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw compileError(config.error);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  const overrides = new Map(changes.map((change) => [resolve(change.file.path), change.nextSource]));
  const host = ts.createCompilerHost(parsed.options, true);
  const readFile = host.readFile.bind(host);
  host.readFile = (candidate) => overrides.get(resolve(candidate)) ?? readFile(candidate);
  const rootNames = [...new Set([...parsed.fileNames.map((candidate) => resolve(candidate)), ...overrides.keys()])];
  const program = ts.createProgram({
    rootNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    host,
  });
  const diagnostic = ts.getPreEmitDiagnostics(program).find((candidate) => candidate.category === ts.DiagnosticCategory.Error);
  if (diagnostic) throw compileError(diagnostic);
}

function compileError(diagnostic: ts.Diagnostic): DesignSpaceError {
  return new DesignSpaceError("COMPILE_ERROR", "The source change set did not compile", {
    diagnostic: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  });
}
