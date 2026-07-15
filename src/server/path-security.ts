import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { DesignSpaceError } from "./errors";

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export async function canonicalRoot(root: string): Promise<string> {
  if (!isAbsolute(root)) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "The trusted project root must be absolute");
  }
  return realpath(root);
}

export async function canonicalRegisteredFile(root: string, relativePath: string): Promise<string> {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Registered files must use confined relative paths");
  }

  const candidate = await realpath(resolve(root, relativePath));
  if (!isWithin(root, candidate)) {
    throw new DesignSpaceError("ACCESS_DENIED", "A registered file resolves outside the project root");
  }
  return candidate;
}

export async function assertStillRegistered(root: string, expectedPath: string): Promise<void> {
  const current = await realpath(expectedPath);
  if (current !== expectedPath || !isWithin(root, current)) {
    throw new DesignSpaceError("ACCESS_DENIED", "The registered file is no longer confined to the project");
  }
}
