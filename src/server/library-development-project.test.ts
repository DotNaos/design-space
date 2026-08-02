import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseGitWorktreeList } from "./library-development-project";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("library development worktrees", () => {
  it("lists every checkout that contains the configured UI package", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-library-"));
    temporaryDirectories.push(root);
    const ready = join(root, "ready");
    const incomplete = join(root, "incomplete");
    await mkdir(join(ready, "packages", "react-ui"), { recursive: true });
    await mkdir(join(incomplete, "packages", "react-ui"), { recursive: true });
    await writeFile(join(ready, "packages", "react-ui", "package.json"), "{}");
    await writeFile(join(incomplete, "packages", "react-ui", "README.md"), "Not a package");

    const result = await parseGitWorktreeList([
      `worktree ${ready}`,
      `HEAD ${"a".repeat(40)}`,
      "branch refs/heads/main",
      "",
      `worktree ${incomplete}`,
      `HEAD ${"b".repeat(40)}`,
      "detached",
      "",
    ].join("\n"), "packages/react-ui");

    expect(result).toEqual([
      expect.objectContaining({
        active: false,
        branch: "main",
        head: "a".repeat(40),
        packageReady: true,
        path: ready,
      }),
      expect.objectContaining({
        active: false,
        branch: `Detached · ${"b".repeat(8)}`,
        head: "b".repeat(40),
        packageReady: false,
        path: incomplete,
      }),
    ]);
    expect(result[0]?.id).toMatch(/^worktree-[a-f0-9]{20}$/);
  });
});
