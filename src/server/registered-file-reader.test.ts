import { mkdtemp, open as actualOpen, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const openState = vi.hoisted(() => ({ beforeOpen: undefined as undefined | (() => Promise<void>) }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    open: async (...args: Parameters<typeof original.open>) => {
      const beforeOpen = openState.beforeOpen;
      openState.beforeOpen = undefined;
      await beforeOpen?.();
      return original.open(...args);
    },
  };
});

import { readRegisteredFile } from "./registered-file-reader";

describe("registered file reader", () => {
  const roots: string[] = [];

  afterEach(async () => {
    openState.beforeOpen = undefined;
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("rejects a symlink swapped in after the confinement check but before opening", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-registered-read-"));
    const outside = await mkdtemp(join(tmpdir(), "design-space-registered-outside-"));
    roots.push(root, outside);
    const registeredPath = join(root, "document.json");
    const outsidePath = join(outside, "secret.json");
    await writeFile(registeredPath, "registered\n");
    await writeFile(outsidePath, "secret\n");
    openState.beforeOpen = async () => {
      await rm(registeredPath);
      await symlink(outsidePath, registeredPath);
    };

    await expect(readRegisteredFile(root, registeredPath)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(await actualOpen(outsidePath).then(async (handle) => {
      try {
        return await handle.readFile("utf8");
      } finally {
        await handle.close();
      }
    })).toBe("secret\n");
  });

  it("enforces the configured byte limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-registered-bounds-"));
    roots.push(root);
    const path = join(root, "document.json");
    await writeFile(path, "12345");

    await expect(readRegisteredFile(root, path, { maximumBytes: 4 })).rejects.toMatchObject({
      code: "ACCESS_DENIED",
    });
  });
});
