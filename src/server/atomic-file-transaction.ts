import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";
import { sourceVersion } from "./source-editor";
import type { RegisteredFile } from "./target-registration";

export interface FileTransactionChange {
  file: RegisteredFile;
  expectedVersion: string;
  nextSource: string;
}

export interface FileTransactionHooks {
  beforeInstall?: () => void | Promise<void>;
  afterInstall?: (fileId: string, installedCount: number) => void | Promise<void>;
}

interface StagedChange extends FileTransactionChange {
  mode: number;
  device: number;
  inode: number;
  parentPath: string;
  parentDevice: number;
  parentInode: number;
  temporaryPath: string;
  backupPath: string;
  temporaryReady: boolean;
  backupReady: boolean;
  installed: boolean;
}

export async function commitFileTransaction(
  root: string,
  changes: readonly FileTransactionChange[],
  hooks: FileTransactionHooks = {},
): Promise<void> {
  if (changes.length === 0) return;
  const ids = changes.map((change) => change.file.id);
  if (new Set(ids).size !== ids.length) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "A file transaction cannot write the same file twice");
  }

  const staged: StagedChange[] = [];
  try {
    for (const change of [...changes].sort((left, right) => left.file.id.localeCompare(right.file.id, "en"))) {
      staged.push(await stageChange(root, change));
    }
    await hooks.beforeInstall?.();
    for (const [index, change] of staged.entries()) {
      await verifyIdentity(root, change);
      await rename(change.file.path, change.backupPath);
      change.backupReady = true;
      await rename(change.temporaryPath, change.file.path);
      change.temporaryReady = false;
      change.installed = true;
      await hooks.afterInstall?.(change.file.id, index + 1);
    }
    for (const change of staged) {
      await assertStillRegistered(root, change.file.path);
      const installedSource = await readFile(change.file.path, "utf8");
      if (sourceVersion(installedSource) !== sourceVersion(change.nextSource)) {
        throw new DesignSpaceError("TRANSACTION_FAILED", "A staged file did not install exactly");
      }
    }
  } catch (error) {
    const rollbackErrors = await rollback(staged);
    await cleanup(staged, rollbackErrors.length === 0);
    if (rollbackErrors.length > 0) {
      throw new DesignSpaceError(
        "TRANSACTION_FAILED",
        "The file transaction failed and requires manual recovery",
      );
    }
    if (error instanceof DesignSpaceError) throw error;
    throw new DesignSpaceError("TRANSACTION_FAILED", "The file transaction failed and was rolled back");
  }

  await cleanup(staged, true);
}

async function stageChange(root: string, change: FileTransactionChange): Promise<StagedChange> {
  await assertStillRegistered(root, change.file.path);
  const parentPath = await realpath(dirname(change.file.path));
  const parent = await stat(parentPath);
  const current = await lstat(change.file.path);
  if (current.isSymbolicLink()) {
    throw new DesignSpaceError("ACCESS_DENIED", "Symbolic-link writes are forbidden");
  }
  const currentSource = await readFile(change.file.path, "utf8");
  if (sourceVersion(currentSource) !== change.expectedVersion) {
    throw new DesignSpaceError("STALE_SOURCE", "A registered source changed before the transaction started");
  }

  const nonce = randomUUID();
  const temporaryPath = join(parentPath, `.${basename(change.file.path)}.design-space-${nonce}.tmp`);
  const backupPath = join(parentPath, `.${basename(change.file.path)}.design-space-${nonce}.bak`);
  const staged: StagedChange = {
    ...change,
    mode: current.mode,
    device: current.dev,
    inode: current.ino,
    parentPath,
    parentDevice: parent.dev,
    parentInode: parent.ino,
    temporaryPath,
    backupPath,
    temporaryReady: false,
    backupReady: false,
    installed: false,
  };
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      current.mode,
    );
    staged.temporaryReady = true;
    await handle.writeFile(change.nextSource, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, current.mode);
    return staged;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function verifyIdentity(root: string, change: StagedChange): Promise<void> {
  await assertStillRegistered(root, change.file.path);
  const currentParentPath = await realpath(dirname(change.file.path));
  const currentParent = await stat(currentParentPath);
  const current = await lstat(change.file.path);
  if (
    currentParentPath !== change.parentPath ||
    currentParent.dev !== change.parentDevice ||
    currentParent.ino !== change.parentInode ||
    current.dev !== change.device ||
    current.ino !== change.inode ||
    current.isSymbolicLink()
  ) {
    throw new DesignSpaceError("ACCESS_DENIED", "A registered file changed during transaction staging");
  }
  const currentSource = await readFile(change.file.path, "utf8");
  if (sourceVersion(currentSource) !== change.expectedVersion) {
    throw new DesignSpaceError("STALE_SOURCE", "A registered source changed during transaction staging");
  }
}

async function rollback(staged: readonly StagedChange[]): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (const change of [...staged].reverse()) {
    if (!change.backupReady) continue;
    try {
      if (change.installed) await rm(change.file.path, { force: true });
      await rename(change.backupPath, change.file.path);
      change.backupReady = false;
      change.installed = false;
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

async function cleanup(staged: readonly StagedChange[], removeBackups: boolean): Promise<void> {
  await Promise.all(staged.flatMap((change) => [
    change.temporaryReady ? rm(change.temporaryPath, { force: true }) : Promise.resolve(),
    removeBackups && change.backupReady ? rm(change.backupPath, { force: true }) : Promise.resolve(),
  ]).map((operation) => operation.catch(() => undefined)));
}
