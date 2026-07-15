import { constants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";

import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";

export const MAXIMUM_REGISTERED_SOURCE_BYTES = 1024 * 1024;

interface RegisteredFileReadOptions {
  maximumBytes?: number;
  unavailableMessage?: string;
}

interface FileIdentity {
  dev: number;
  ino: number;
}

function accessDenied(message: string): DesignSpaceError {
  return new DesignSpaceError("ACCESS_DENIED", message);
}

async function assertConfined(root: string, path: string, message: string): Promise<void> {
  try {
    await assertStillRegistered(root, path);
  } catch (error) {
    if (error instanceof DesignSpaceError) throw error;
    throw accessDenied(message);
  }
}

async function assertOpenFileStillRegistered(
  root: string,
  path: string,
  identity: FileIdentity,
  message: string,
): Promise<void> {
  await assertConfined(root, path, message);
  try {
    const current = await lstat(path);
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino) {
      throw accessDenied(message);
    }
  } catch (error) {
    if (error instanceof DesignSpaceError) throw error;
    throw accessDenied(message);
  }
}

async function readAtMost(handle: FileHandle, maximumBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (totalBytes <= maximumBytes) {
    const remaining = maximumBytes + 1 - totalBytes;
    const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
    const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    chunks.push(buffer.subarray(0, bytesRead));
  }
  if (totalBytes > maximumBytes) {
    throw accessDenied("The registered source file is too large");
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

/** Reads a fixed registered path through a no-follow handle with a hard byte bound. */
export async function readRegisteredFile(
  root: string,
  path: string,
  options: RegisteredFileReadOptions = {},
): Promise<string> {
  const maximumBytes = options.maximumBytes ?? MAXIMUM_REGISTERED_SOURCE_BYTES;
  const unavailableMessage = options.unavailableMessage ?? "The registered source file is unavailable";
  await assertConfined(root, path, unavailableMessage);

  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw accessDenied(unavailableMessage);
  }

  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > maximumBytes) {
      throw accessDenied(metadata.size > maximumBytes
        ? "The registered source file is too large"
        : unavailableMessage);
    }
    const identity = { dev: metadata.dev, ino: metadata.ino };
    await assertOpenFileStillRegistered(root, path, identity, unavailableMessage);
    const source = await readAtMost(handle, maximumBytes);
    await assertOpenFileStillRegistered(root, path, identity, unavailableMessage);
    return source;
  } finally {
    await handle.close();
  }
}
