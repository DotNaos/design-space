import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, realpath, rm, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import type {
  PreparedSourceComponentCreate,
  SavedSourceComponentCreate,
} from "../shared/contracts";
import { ChallengeStore } from "./challenge-store";
import { createNewFileDiff } from "./diff";
import { DesignSpaceError } from "./errors";
import {
  assertStillRegistered,
  assertStillRegisteredDirectory,
  canonicalRegisteredDirectory,
} from "./path-security";
import { assertEditedTypeScriptCompiles } from "./typescript-project-compiler";

const componentName = /^[A-Z][A-Za-z0-9]{1,63}$/;

export interface RegisteredSourceComponentStore {
  directory: {
    path: string;
    displayName: string;
    device: number;
    inode: number;
  };
  fileName: "desktop.tsx" | "index.tsx";
}

interface StoredSourceComponentCreate {
  id: string;
  name: string;
  relativePath: string;
  directoryPath: string;
  filePath: string;
  source: string;
  expiresAt: number;
}

export async function registerSourceComponentStore(
  root: string,
  relativeDirectory: string,
  fileName: RegisteredSourceComponentStore["fileName"],
): Promise<RegisteredSourceComponentStore | undefined> {
  let path: string;
  try {
    path = await canonicalRegisteredDirectory(root, relativeDirectory);
  } catch (error) {
    if (isCode(error, "ENOENT")) return undefined;
    throw error;
  }
  const metadata = await stat(path);
  return {
    directory: {
      path,
      displayName: relative(root, path).replaceAll("\\", "/"),
      device: metadata.dev,
      inode: metadata.ino,
    },
    fileName,
  };
}

export class SourceComponentCreation {
  readonly #root: string;
  readonly #store?: RegisteredSourceComponentStore;
  readonly #challenges: ChallengeStore<StoredSourceComponentCreate>;
  readonly #challengeTtlMs: number;
  readonly #now: () => number;
  readonly #createId: () => string;
  #saveQueue: Promise<void> = Promise.resolve();

  constructor(options: {
    root: string;
    store?: RegisteredSourceComponentStore;
    challengeTtlMs?: number;
    now?: () => number;
    createId?: () => string;
  }) {
    this.#root = options.root;
    this.#store = options.store;
    this.#challengeTtlMs = options.challengeTtlMs ?? 60_000;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? randomUUID;
    this.#challenges = new ChallengeStore({ now: this.#now });
  }

  async prepare(name: string): Promise<PreparedSourceComponentCreate> {
    const store = this.#requiredStore();
    if (!componentName.test(name)) {
      throw new DesignSpaceError("INVALID_REQUEST", "Component names must use PascalCase");
    }
    await assertSourceComponentStoreIdentity(this.#root, store);
    const directoryPath = join(store.directory.path, name);
    const filePath = join(directoryPath, store.fileName);
    await assertAbsent(directoryPath);
    const source = componentSource(name);
    assertEditedTypeScriptCompiles(this.#root, filePath, source);
    const id = this.#createId();
    const expiresAt = this.#now() + this.#challengeTtlMs;
    const relativePath = `${store.directory.displayName}/${name}/${store.fileName}`;
    this.#challenges.set(id, { id, name, relativePath, directoryPath, filePath, source, expiresAt });
    return {
      state: "source-component-create-ready",
      challengeId: id,
      name,
      relativePath,
      diff: createNewFileDiff(source, relativePath),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  save(challengeId: string): Promise<SavedSourceComponentCreate> {
    const pending = this.#saveQueue.then(() => this.#saveNow(challengeId));
    this.#saveQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async #saveNow(challengeId: string): Promise<SavedSourceComponentCreate> {
    const challenge = this.#challenges.take(challengeId);
    if (!challenge) throw new DesignSpaceError("NOT_FOUND", "The prepared component does not exist");
    if (challenge.expiresAt <= this.#now()) {
      throw new DesignSpaceError("CHALLENGE_EXPIRED", "The prepared component expired before it was saved");
    }
    const store = this.#requiredStore();
    await commitNewSourceComponent(this.#root, store, challenge);
    return {
      state: "source-component-created",
      name: challenge.name,
      relativePath: challenge.relativePath,
    };
  }

  #requiredStore(): RegisteredSourceComponentStore {
    if (!this.#store) {
      throw new DesignSpaceError("ACCESS_DENIED", "This source project has no registered component directory");
    }
    return this.#store;
  }
}

export async function assertSourceComponentStoreIdentity(
  root: string,
  store: RegisteredSourceComponentStore,
): Promise<void> {
  await assertStillRegisteredDirectory(root, store.directory.path);
  const current = await stat(store.directory.path);
  if (current.dev !== store.directory.device || current.ino !== store.directory.inode) {
    throw new DesignSpaceError("ACCESS_DENIED", "The component directory changed after registration");
  }
}

async function commitNewSourceComponent(
  root: string,
  store: RegisteredSourceComponentStore,
  creation: StoredSourceComponentCreate,
): Promise<void> {
  await assertSourceComponentStoreIdentity(root, store);
  await assertAbsent(creation.directoryPath);
  let directoryIdentity: Readonly<{ device: number; inode: number }> | undefined;
  let installedIdentity: Readonly<{ device: number; inode: number }> | undefined;
  const temporaryPath = join(
    creation.directoryPath,
    `.${basename(creation.filePath)}.design-space-${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await mkdir(creation.directoryPath, { mode: 0o755 });
    const directory = await lstat(creation.directoryPath);
    directoryIdentity = { device: directory.dev, inode: directory.ino };
    if (!directory.isDirectory() || directory.isSymbolicLink() || await realpath(creation.directoryPath) !== creation.directoryPath) {
      throw new DesignSpaceError("ACCESS_DENIED", "The component directory did not install safely");
    }
    await assertSourceComponentStoreIdentity(root, store);
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o644,
    );
    await handle.writeFile(creation.source, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await assertCreatedDirectoryIdentity(creation.directoryPath, directoryIdentity);
    await assertSourceComponentStoreIdentity(root, store);
    await link(temporaryPath, creation.filePath);
    const file = await lstat(creation.filePath);
    installedIdentity = { device: file.dev, inode: file.ino };
    if (!file.isFile() || file.isSymbolicLink() || await realpath(creation.filePath) !== creation.filePath) {
      throw new DesignSpaceError("ACCESS_DENIED", "The component source did not install safely");
    }
    await assertStillRegistered(root, creation.filePath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (installedIdentity) await removeInstalledFile(creation.filePath, installedIdentity);
    if (directoryIdentity) await removeCreatedDirectory(creation.directoryPath, directoryIdentity);
    if (error instanceof DesignSpaceError) throw error;
    if (isCode(error, "EEXIST")) {
      throw new DesignSpaceError("STALE_SOURCE", "The component destination already exists");
    }
    throw new DesignSpaceError("TRANSACTION_FAILED", "The component could not be created safely");
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function assertCreatedDirectoryIdentity(
  path: string,
  expected: Readonly<{ device: number; inode: number }>,
): Promise<void> {
  const current = await lstat(path);
  if (
    current.dev !== expected.device ||
    current.ino !== expected.inode ||
    !current.isDirectory() ||
    current.isSymbolicLink() ||
    await realpath(path) !== path
  ) {
    throw new DesignSpaceError("ACCESS_DENIED", "The component directory changed during creation");
  }
}

async function removeInstalledFile(
  path: string,
  expected: Readonly<{ device: number; inode: number }>,
): Promise<void> {
  const current = await lstat(path).catch((error) => isCode(error, "ENOENT") ? undefined : Promise.reject(error));
  if (!current) return;
  if (current.dev !== expected.device || current.ino !== expected.inode || current.isSymbolicLink()) {
    throw new DesignSpaceError("TRANSACTION_FAILED", "A failed component install requires manual recovery");
  }
  await rm(path);
}

async function removeCreatedDirectory(
  path: string,
  expected: Readonly<{ device: number; inode: number }>,
): Promise<void> {
  const current = await lstat(path).catch((error) => isCode(error, "ENOENT") ? undefined : Promise.reject(error));
  if (!current) return;
  if (current.dev !== expected.device || current.ino !== expected.inode || current.isSymbolicLink()) {
    throw new DesignSpaceError("TRANSACTION_FAILED", "A failed component directory requires manual recovery");
  }
  await rm(path, { recursive: true });
}

async function assertAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    throw new DesignSpaceError("STALE_SOURCE", "The component destination already exists");
  } catch (error) {
    if (error instanceof DesignSpaceError) throw error;
    if (!isCode(error, "ENOENT")) throw error;
  }
}

function componentSource(name: string): string {
  return [
    'import type { ReactNode } from "react";',
    "",
    `export interface ${name}Props {`,
    "  children?: ReactNode;",
    "  label?: string;",
    "}",
    "",
    `export function ${name}({ children, label = ${JSON.stringify(name)} }: ${name}Props) {`,
    "  return <div>{children ?? label}</div>;",
    "}",
    "",
  ].join("\n");
}

function isCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
