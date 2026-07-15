import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, link, open, realpath, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { DesignSpaceError } from "./errors";
import {
  assertManagedDirectoryIdentity,
  type RegisteredManagedDocumentStore,
} from "./managed-document-registration";
import { assertStillRegistered } from "./path-security";
import type { RegisteredFile } from "./target-registration";

export interface NewFileTransactionHooks {
  beforeInstall?: () => void | Promise<void>;
}

export async function commitNewManagedFile(
  root: string,
  store: RegisteredManagedDocumentStore,
  file: RegisteredFile,
  source: string,
  hooks: NewFileTransactionHooks = {},
): Promise<void> {
  if (dirname(file.path) !== store.directory.path || !basename(file.path).endsWith(".design.json")) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "A managed file must use its registered directory and suffix");
  }
  await assertManagedDirectoryIdentity(root, store);
  await assertAbsent(file.path);

  const temporaryPath = join(store.directory.path, `.${basename(file.path)}.design-space-${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let installedIdentity: Readonly<{ device: number; inode: number }> | undefined;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(source, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;

    await assertManagedDirectoryIdentity(root, store);
    await hooks.beforeInstall?.();
    await assertManagedDirectoryIdentity(root, store);
    await link(temporaryPath, file.path);
    const installed = await lstat(file.path);
    installedIdentity = { device: installed.dev, inode: installed.ino };
    if (!installed.isFile() || installed.isSymbolicLink() || await realpath(file.path) !== file.path) {
      throw new DesignSpaceError("ACCESS_DENIED", "The managed document did not install as a confined regular file");
    }
    await assertStillRegistered(root, file.path);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (installedIdentity) await removeInstalledFile(file.path, installedIdentity);
    if (error instanceof DesignSpaceError) throw error;
    if (isCode(error, "EEXIST")) {
      throw new DesignSpaceError("STALE_SOURCE", "The managed document destination already exists");
    }
    throw new DesignSpaceError("TRANSACTION_FAILED", "The managed document could not be created safely");
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function assertAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    throw new DesignSpaceError("STALE_SOURCE", "The managed document destination already exists");
  } catch (error) {
    if (error instanceof DesignSpaceError) throw error;
    if (!isCode(error, "ENOENT")) throw error;
  }
}

async function removeInstalledFile(path: string, expected: Readonly<{ device: number; inode: number }>): Promise<void> {
  try {
    const current = await lstat(path);
    if (current.dev !== expected.device || current.ino !== expected.inode || current.isSymbolicLink()) {
      throw new DesignSpaceError("TRANSACTION_FAILED", "A failed managed-file install requires manual recovery");
    }
    await rm(path);
  } catch (error) {
    if (isCode(error, "ENOENT")) return;
    throw error;
  }
}

function isCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
