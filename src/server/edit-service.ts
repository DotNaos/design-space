import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, open, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { transformWithEsbuild } from "vite";

import {
  browserOperationSchema,
  type BrowserOperation,
  type PreparedEdit,
  type ProjectFileSnapshot,
  type SavedEdit,
  type SourceSnapshot,
  type TailwindIntelligence,
  type TailwindPreview,
} from "../shared/contracts";
import { createUnifiedDiff } from "./diff";
import { ChallengeStore } from "./challenge-store";
import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";
import { readRegisteredFile } from "./registered-file-reader";
import { locateMarkedString, sourceVersion } from "./source-editor";
import { TargetTailwindService } from "./target-tailwind-service";
import { TailwindIntelligenceService } from "./tailwind-intelligence-service";
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

const maximumBrowsableFileBytes = 512 * 1024;

export interface EditServiceOptions {
  challengeTtlMs?: number;
  now?: () => number;
  createId?: () => string;
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
  readonly #challengeTtlMs: number;
  readonly #now: () => number;
  readonly #createId: () => string;
  readonly #tailwind: TargetTailwindService;
  readonly #tailwindIntelligence: TailwindIntelligenceService;
  #saveQueue: Promise<void> = Promise.resolve();

  constructor(target: RegisteredTarget, options: EditServiceOptions = {}) {
    this.#target = target;
    this.#challengeTtlMs = options.challengeTtlMs ?? 60_000;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? randomUUID;
    this.#challenges = new ChallengeStore({ now: this.#now });
    this.#tailwind = new TargetTailwindService(target);
    this.#tailwindIntelligence = new TailwindIntelligenceService(target);
  }

  async execute(input: unknown): Promise<SourceSnapshot | ProjectFileSnapshot | PreparedEdit | SavedEdit | TailwindPreview | TailwindIntelligence> {
    const parsed = browserOperationSchema.safeParse(input);
    if (!parsed.success) {
      throw new DesignSpaceError("INVALID_REQUEST", "The browser operation is invalid");
    }
    return this.#executeParsed(parsed.data);
  }

  async #executeParsed(operation: BrowserOperation): Promise<SourceSnapshot | ProjectFileSnapshot | PreparedEdit | SavedEdit | TailwindPreview | TailwindIntelligence> {
    switch (operation.type) {
      case "analyze-tailwind":
        return this.#tailwindIntelligence.analyze(operation.value, operation.cursor);
      case "compile-tailwind":
        return (await this.#tailwind.compile(operation.value)).preview;
      case "read-project-file":
        return this.readProjectFile(operation.fileId);
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

  async readProjectFile(fileId: string): Promise<ProjectFileSnapshot> {
    const file = this.#target.files.get(fileId);
    if (!file) throw new DesignSpaceError("NOT_FOUND", "The project file is not registered");
    const source = await readRegisteredFile(this.#target.root, file.path, {
      maximumBytes: maximumBrowsableFileBytes,
      unavailableMessage: "The registered file is not available for source browsing",
    });
    return { fileId, label: file.displayName, source, version: sourceVersion(source) };
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
