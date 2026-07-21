import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, open, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { transformWithEsbuild } from "vite";

import {
  type AppliedSourceChangeSet,
  browserOperationSchema,
  type BrowserOperation,
  type GeneratedSourceDesign,
  type PreparedEdit,
  type PreparedProjectFileEdit,
  type PreparedSourceChangeSet,
  type PreparedSourceComponentCreate,
  type ProjectFileSnapshot,
  type SavedEdit,
  type SavedProjectFileEdit,
  type SavedSourceComponentCreate,
  type SourceDraftAnalysis,
  type SourceSnapshot,
  type TailwindIntelligence,
  type TailwindPreview,
} from "../shared/contracts";
import type { SourceDesignScope } from "../shared/source-design";
import { createUnifiedDiff } from "./diff";
import { ChallengeStore } from "./challenge-store";
import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";
import { readRegisteredFile } from "./registered-file-reader";
import { SourceComponentCreation } from "./source-component-creation";
import { SourceDesignGeneration } from "./source-design-generation";
import type { SourceDraftPreviewRegistry } from "./source-draft-preview-registry";
import { SourceChangeSetService } from "./source-change-set-service";
import { locateMarkedString, sourceVersion } from "./source-editor";
import { assertStrictUiSourceChangesDoNotRegress } from "./strict-ui-source-validation";
import { TargetTailwindService } from "./target-tailwind-service";
import { compileWorkspaceTailwindPreview } from "./tailwind-preview";
import { TailwindIntelligenceService } from "./tailwind-intelligence-service";
import { assertEditedTypeScriptCompiles } from "./typescript-project-compiler";
import { indexTypeScriptComponents } from "./typescript-component-index";
import type {
  RegisteredEditTarget,
  RegisteredFile,
  RegisteredTarget,
} from "./target-registration";

interface StoredChallenge {
  id: string;
  editTargetId: string;
  file: RegisteredFile;
  editTarget: RegisteredEditTarget;
  baseVersion: string;
  nextVersion: string;
  nextSource: string;
  value: string;
  tailwindSourceVersions: Readonly<Record<string, string>>;
  expiresAt: number;
}

interface StoredProjectFileChallenge {
  id: string;
  file: RegisteredFile;
  baseVersion: string;
  nextVersion: string;
  nextSource: string;
  expiresAt: number;
}

const maximumBrowsableFileBytes = 512 * 1024;

export interface EditServiceOptions {
  challengeTtlMs?: number;
  sourceChangeSetChallengeTtlMs?: number;
  now?: () => number;
  createId?: () => string;
  sourceDraftPreviews?: SourceDraftPreviewRegistry;
}

async function atomicWrite(root: string, path: string, expectedVersion: string, source: string): Promise<void> {
  await assertStillRegistered(root, path);
  const parentPath = await realpath(dirname(path));
  const parentIdentity = await stat(parentPath);
  const current = await lstat(path);
  if (current.isSymbolicLink()) throw new DesignSpaceError("ACCESS_DENIED", "Symbolic-link writes are forbidden");
  const temporaryPath = join(parentPath, `.${basename(path)}.design-space-${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      current.mode,
    );
    await handle.writeFile(source, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, current.mode);
    await assertStillRegistered(root, path);
    const currentParentPath = await realpath(dirname(path));
    const currentParent = await stat(currentParentPath);
    const currentTarget = await lstat(path);
    if (
      currentParentPath !== parentPath ||
      currentParent.dev !== parentIdentity.dev ||
      currentParent.ino !== parentIdentity.ino ||
      currentTarget.dev !== current.dev ||
      currentTarget.ino !== current.ino ||
      currentTarget.isSymbolicLink()
    ) {
      throw new DesignSpaceError("ACCESS_DENIED", "The registered file changed during the atomic save");
    }
    const currentSource = await readRegisteredFile(root, path);
    if (sourceVersion(currentSource) !== expectedVersion) {
      throw new DesignSpaceError("STALE_SOURCE", "The registered source changed during the atomic save");
    }
    await rename(temporaryPath, path);
    await assertStillRegistered(root, path);
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export class EditService {
  readonly #target: RegisteredTarget;
  readonly #challenges: ChallengeStore<StoredChallenge>;
  readonly #projectFileChallenges: ChallengeStore<StoredProjectFileChallenge>;
  readonly #challengeTtlMs: number;
  readonly #now: () => number;
  readonly #createId: () => string;
  readonly #tailwind: TargetTailwindService;
  readonly #tailwindIntelligence: TailwindIntelligenceService;
  readonly #sourceComponentCreation: SourceComponentCreation;
  readonly #sourceDesignGeneration: SourceDesignGeneration;
  readonly #sourceChangeSets: SourceChangeSetService;
  #saveQueue: Promise<void> = Promise.resolve();

  constructor(target: RegisteredTarget, options: EditServiceOptions = {}) {
    this.#target = target;
    this.#challengeTtlMs = options.challengeTtlMs ?? 60_000;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? randomUUID;
    this.#challenges = new ChallengeStore({ now: this.#now });
    this.#projectFileChallenges = new ChallengeStore({ now: this.#now });
    this.#tailwind = new TargetTailwindService(target);
    this.#tailwindIntelligence = new TailwindIntelligenceService(target);
    this.#sourceComponentCreation = new SourceComponentCreation({
      root: target.root,
      store: target.sourceComponentStore,
      challengeTtlMs: this.#challengeTtlMs,
      now: this.#now,
      createId: this.#createId,
    });
    this.#sourceDesignGeneration = new SourceDesignGeneration(target);
    this.#sourceChangeSets = new SourceChangeSetService(target, {
      challengeTtlMs: options.sourceChangeSetChallengeTtlMs,
      now: this.#now,
      createId: this.#createId,
      previewRegistry: options.sourceDraftPreviews,
    });
  }

  async execute(input: unknown): Promise<SourceSnapshot | ProjectFileSnapshot | SourceDraftAnalysis | PreparedEdit | PreparedProjectFileEdit | PreparedSourceChangeSet | PreparedSourceComponentCreate | SavedEdit | SavedProjectFileEdit | AppliedSourceChangeSet | SavedSourceComponentCreate | GeneratedSourceDesign | TailwindPreview | TailwindIntelligence> {
    const parsed = browserOperationSchema.safeParse(input);
    if (!parsed.success) {
      throw new DesignSpaceError("INVALID_REQUEST", "The browser operation is invalid");
    }
    return this.#executeParsed(parsed.data);
  }

  async #executeParsed(operation: BrowserOperation): Promise<SourceSnapshot | ProjectFileSnapshot | SourceDraftAnalysis | PreparedEdit | PreparedProjectFileEdit | PreparedSourceChangeSet | PreparedSourceComponentCreate | SavedEdit | SavedProjectFileEdit | AppliedSourceChangeSet | SavedSourceComponentCreate | GeneratedSourceDesign | TailwindPreview | TailwindIntelligence> {
    switch (operation.type) {
      case "analyze-tailwind":
        return this.#tailwindIntelligence.analyze(operation.value, operation.cursor);
      case "compile-tailwind":
        if (operation.scope === "library-development") {
          const workspace = this.#target.sourceLibrary?.development;
          if (!workspace) throw new DesignSpaceError("ACCESS_DENIED", "The development library source is not attached");
          return compileWorkspaceTailwindPreview(operation.value, workspace.root, workspace.stylePaths);
        }
        return (await this.#tailwind.compile(operation.value)).preview;
      case "read-project-file":
        return this.readProjectFile(operation.fileId, operation.scope);
      case "analyze-source-file-draft":
        return this.analyzeSourceFileDraft(operation.fileId, operation.source, operation.scope);
      case "prepare-project-file-edit":
        return this.prepareProjectFileEdit(operation.fileId, operation.source, operation.baseVersion);
      case "save-project-file-edit":
        return this.saveProjectFileEdit(operation.challengeId);
      case "prepare-source-change-set":
        return this.#sourceChangeSets.prepare(
          operation.scope,
          operation.changes,
          operation.supersedesChallengeId,
        );
      case "apply-source-change-set":
        return this.#sourceChangeSets.apply(operation.challengeId);
      case "prepare-source-component-create":
        return this.#sourceComponentCreation.prepare(operation.name);
      case "save-source-component-create":
        return this.#sourceComponentCreation.save(operation.challengeId);
      case "generate-source-design":
        return this.#sourceDesignGeneration.generate(operation.scope, operation.entryId);
      case "read-source":
        return this.read(operation.editTargetId);
      case "prepare-edit":
        return this.prepare(operation.editTargetId, operation.value, operation.baseVersion);
      case "save-edit":
        return this.save(operation.challengeId);
    }
  }

  dispose(): void {
    this.#tailwindIntelligence.dispose();
  }

  async readProjectFile(fileId: string, scope?: SourceDesignScope): Promise<ProjectFileSnapshot> {
    const resolved = this.#scopedFile(fileId, scope);
    const source = await readRegisteredFile(resolved.root, resolved.file.path, {
      maximumBytes: maximumBrowsableFileBytes,
      unavailableMessage: "The registered file is not available for source browsing",
    });
    return { fileId, label: resolved.file.displayName, source, version: sourceVersion(source) };
  }

  async analyzeSourceFileDraft(
    fileId: string,
    source: string,
    scope: SourceDesignScope = "app",
  ): Promise<SourceDraftAnalysis> {
    const workspace = scope === "app" ? this.#target.sourceWorkspace : this.#target.sourceLibrary?.development;
    if (!workspace) {
      throw new DesignSpaceError("ACCESS_DENIED", scope === "app"
        ? "This project has no editable source workspace"
        : "The development library source is not attached");
    }
    const resolved = this.#scopedFile(fileId, scope);
    const file = resolved.file;
    if (!/\.tsx?$/.test(file.path)) {
      throw new DesignSpaceError("INVALID_REQUEST", "Only registered TypeScript source targets can be analyzed");
    }
    try {
      const loader = file.displayName.endsWith(".tsx") ? "tsx" : "ts";
      await transformWithEsbuild(source, file.displayName, { loader, jsx: "automatic" });
      assertEditedTypeScriptCompiles(workspace.root, file.path, source);
    } catch {
      throw new DesignSpaceError("COMPILE_ERROR", "The edited TypeScript source did not compile");
    }
    const components = await indexTypeScriptComponents({
      projectRoot: workspace.root,
      filePaths: workspace.files.filter((candidate) => /\.tsx?$/.test(candidate.absolutePath)).map((candidate) => candidate.absolutePath),
      sourceOverrides: new Map([[file.path, source], [file.path.replaceAll("\\", "/"), source]]),
    });
    return { fileId, components };
  }

  async prepareProjectFileEdit(
    fileId: string,
    nextSource: string,
    baseVersion: string,
  ): Promise<PreparedProjectFileEdit> {
    const file = this.#editableProjectFile(fileId);
    const source = await readRegisteredFile(this.#target.root, file.path, {
      maximumBytes: maximumBrowsableFileBytes,
      unavailableMessage: "The registered project source is unavailable for editing",
    });
    if (sourceVersion(source) !== baseVersion) {
      throw new DesignSpaceError("STALE_SOURCE", "The source changed after the editor loaded it");
    }
    if (source === nextSource) {
      throw new DesignSpaceError("INVALID_REQUEST", "The edited source is unchanged");
    }
    try {
      const loader = file.displayName.endsWith(".tsx") ? "tsx" : "ts";
      await transformWithEsbuild(nextSource, file.displayName, { loader, jsx: "automatic" });
      if (this.#target.sourceWorkspace) assertEditedTypeScriptCompiles(this.#target.root, file.path, nextSource);
    } catch {
      throw new DesignSpaceError("COMPILE_ERROR", "The edited TypeScript source did not compile");
    }
    if (this.#target.sourceWorkspace && /\.tsx?$/.test(file.path)) {
      await assertStrictUiSourceChangesDoNotRegress({
        projectRoot: this.#target.sourceWorkspace.root,
        filePaths: this.#target.sourceWorkspace.files
          .filter((candidate) => /\.[cm]?tsx?$/.test(candidate.absolutePath))
          .map((candidate) => candidate.absolutePath),
        changes: [{ filePath: file.path, source: nextSource }],
      });
    }
    const id = this.#createId();
    const expiresAt = this.#now() + this.#challengeTtlMs;
    const nextVersion = sourceVersion(nextSource);
    this.#projectFileChallenges.set(id, {
      id,
      file,
      baseVersion,
      nextVersion,
      nextSource,
      expiresAt,
    });
    return {
      challengeId: id,
      fileId,
      baseVersion,
      nextVersion,
      diff: createUnifiedDiff(source, nextSource, file.displayName),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  saveProjectFileEdit(challengeId: string): Promise<SavedProjectFileEdit> {
    const pending = this.#saveQueue.then(() => this.#saveProjectFileNow(challengeId));
    this.#saveQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async #saveProjectFileNow(challengeId: string): Promise<SavedProjectFileEdit> {
    const challenge = this.#projectFileChallenges.take(challengeId);
    if (!challenge) throw new DesignSpaceError("NOT_FOUND", "The prepared source edit does not exist");
    if (challenge.expiresAt <= this.#now()) {
      throw new DesignSpaceError("CHALLENGE_EXPIRED", "The prepared source edit expired before it was saved");
    }
    const currentSource = await readRegisteredFile(this.#target.root, challenge.file.path);
    if (sourceVersion(currentSource) !== challenge.baseVersion) {
      throw new DesignSpaceError("STALE_SOURCE", "The source changed before the edit could be saved");
    }
    await atomicWrite(this.#target.root, challenge.file.path, challenge.baseVersion, challenge.nextSource);
    await assertStillRegistered(this.#target.root, challenge.file.path);
    return {
      fileId: challenge.file.id,
      label: challenge.file.displayName,
      source: challenge.nextSource,
      version: challenge.nextVersion,
      previousVersion: challenge.baseVersion,
    };
  }

  #editableProjectFile(fileId: string): RegisteredFile {
    if (!this.#target.editableFileIds?.has(fileId)) {
      throw new DesignSpaceError("ACCESS_DENIED", "The project file is not registered for editing");
    }
    const file = this.#target.files.get(fileId);
    if (!file) throw new DesignSpaceError("NOT_FOUND", "The project file is not registered");
    return file;
  }

  #scopedFile(
    fileId: string,
    scope?: SourceDesignScope,
  ): { root: string; file: RegisteredFile } {
    if (scope === "library-development") {
      const workspace = this.#target.sourceLibrary?.development;
      if (!workspace) throw new DesignSpaceError("ACCESS_DENIED", "The development library source is not attached");
      const indexed = workspace.files.find((candidate) => candidate.id === fileId);
      if (!indexed) throw new DesignSpaceError("NOT_FOUND", "The library source file is not registered");
      return {
        root: workspace.root,
        file: { id: indexed.id, path: indexed.absolutePath, displayName: indexed.relativePath },
      };
    }
    const file = this.#target.files.get(fileId);
    if (!file) throw new DesignSpaceError("NOT_FOUND", "The project file is not registered");
    return { root: this.#target.root, file };
  }

  async read(editTargetId: string): Promise<SourceSnapshot> {
    const { editTarget, file } = this.#resolve(editTargetId);
    const source = await readRegisteredFile(this.#target.root, file.path);
    return {
      editTargetId: editTarget.id,
      value: locateMarkedString(source, editTarget.marker).value,
      version: sourceVersion(source),
    };
  }

  async prepare(editTargetId: string, unsafeValue: string, baseVersion: string): Promise<PreparedEdit> {
    const { editTarget, file } = this.#resolve(editTargetId);
    const source = await readRegisteredFile(this.#target.root, file.path);
    const currentVersion = sourceVersion(source);
    if (currentVersion !== baseVersion) {
      throw new DesignSpaceError("STALE_SOURCE", "The source changed after the editor loaded it");
    }

    const tailwind = await this.#tailwind.compile(unsafeValue);
    const { value } = tailwind.preview;
    const located = locateMarkedString(source, editTarget.marker);
    const nextSource = located.nextSource(value);
    const context = { fileId: file.id, editTargetId: editTarget.id, source };
    if (editTarget.validate) {
      try {
        await editTarget.validate(value, context);
      } catch (error) {
        if (error instanceof DesignSpaceError) throw error;
        throw new DesignSpaceError("VALIDATION_ERROR", "The target rejected this edit");
      }
    }
    if (editTarget.compile || editTarget.compiler === "tsx") {
      try {
        if (editTarget.compiler === "tsx") {
          await transformWithEsbuild(nextSource, file.displayName, { loader: "tsx", jsx: "automatic" });
        }
        if (editTarget.compile) await editTarget.compile(nextSource, context);
      } catch {
        throw new DesignSpaceError("COMPILE_ERROR", "The edited target did not compile");
      }
    }
    await this.#tailwind.assertUnchanged(tailwind.sourceVersions);

    const id = this.#createId();
    const expiresAt = this.#now() + this.#challengeTtlMs;
    const nextVersion = sourceVersion(nextSource);
    this.#challenges.set(id, {
      id,
      editTargetId,
      file,
      editTarget,
      baseVersion,
      nextVersion,
      nextSource,
      value,
      tailwindSourceVersions: tailwind.sourceVersions,
      expiresAt,
    });
    return {
      challengeId: id,
      editTargetId,
      baseVersion,
      nextVersion,
      diff: createUnifiedDiff(source, nextSource, file.displayName),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  save(challengeId: string): Promise<SavedEdit> {
    const pending = this.#saveQueue.then(() => this.#saveNow(challengeId));
    this.#saveQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async #saveNow(challengeId: string): Promise<SavedEdit> {
    const challenge = this.#challenges.take(challengeId);
    if (!challenge) {
      throw new DesignSpaceError("NOT_FOUND", "The prepared edit does not exist");
    }
    if (challenge.expiresAt <= this.#now()) {
      throw new DesignSpaceError("CHALLENGE_EXPIRED", "The prepared edit expired before it was saved");
    }
    const currentSource = await readRegisteredFile(this.#target.root, challenge.file.path);
    if (sourceVersion(currentSource) !== challenge.baseVersion) {
      throw new DesignSpaceError("STALE_SOURCE", "The source changed before the edit could be saved");
    }
    await this.#tailwind.assertUnchanged(challenge.tailwindSourceVersions);
    await atomicWrite(this.#target.root, challenge.file.path, challenge.baseVersion, challenge.nextSource);
    await assertStillRegistered(this.#target.root, challenge.file.path);
    return {
      editTargetId: challenge.editTargetId,
      value: challenge.value,
      version: challenge.nextVersion,
      previousVersion: challenge.baseVersion,
    };
  }

  #resolve(editTargetId: string): { editTarget: RegisteredEditTarget; file: RegisteredFile } {
    const editTarget = this.#target.editTargets.get(editTargetId);
    if (!editTarget) {
      throw new DesignSpaceError("NOT_FOUND", "The edit target is not registered");
    }
    const file = this.#target.files.get(editTarget.fileId);
    if (!file) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The edit target file is not registered");
    }
    return { editTarget, file };
  }

}
