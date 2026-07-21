import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import type { IndexedSourceWorkspace } from "./source-file-index";
import {
  parseSourceDraftPreviewModuleId,
  SourceDraftPreviewRegistry,
  sourceDraftPreviewModuleId,
  sourceDraftPreviewModuleUrl,
} from "./source-draft-preview-registry";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

it("keeps validated app and library preview modules isolated in memory", async () => {
  const app = await workspace("app", "export const value = 'app base';\n");
  const library = await workspace("library", "export const value = 'library base';\n");
  const registry = new SourceDraftPreviewRegistry(() => 100);
  registry.register({
    challengeId: "app-challenge",
    scope: "app",
    workspace: app,
    changes: [{ fileId: "shared.file", source: "export const value = 'app draft';\n" }],
    expiresAt: 200,
  });
  registry.register({
    challengeId: "library-challenge",
    scope: "library-development",
    workspace: library,
    changes: [{ fileId: "shared.file", source: "export const value = 'library draft';\n" }],
    expiresAt: 200,
  });

  await expect(registry.load("app-challenge", "shared.file")).resolves.toMatchObject({
    source: "export const value = 'app draft';\n",
  });
  await expect(registry.load("library-challenge", "shared.file")).resolves.toMatchObject({
    source: "export const value = 'library draft';\n",
  });
  await expect(readFile(app.files[0]!.absolutePath, "utf8")).resolves.toBe("export const value = 'app base';\n");
  await expect(readFile(library.files[0]!.absolutePath, "utf8")).resolves.toBe("export const value = 'library base';\n");
});

it("uses opaque module IDs and stops serving an expired prepared preview", async () => {
  let now = 10;
  const source = await workspace("app", "export const value = 1;\n");
  const registry = new SourceDraftPreviewRegistry(() => now);
  registry.register({
    challengeId: "challenge/with separators",
    scope: "app",
    workspace: source,
    changes: [],
    expiresAt: 20,
  });
  const id = sourceDraftPreviewModuleId("challenge/with separators", "shared.file", "src/source.tsx");

  expect(parseSourceDraftPreviewModuleId(id)).toEqual({ challengeId: "challenge/with separators", fileId: "shared.file" });
  expect(sourceDraftPreviewModuleUrl("challenge/with separators", "shared.file", "src/source.tsx")).toBe(
    "/__design-space/source-preview/challenge%2Fwith%20separators/shared.file/module.tsx",
  );
  await expect(registry.load("challenge/with separators", "shared.file")).resolves.toMatchObject({
    source: "export const value = 1;\n",
  });
  now = 20;
  await expect(registry.load("challenge/with separators", "shared.file")).resolves.toBeUndefined();
});

it("prunes every expired registration before adding another prepared preview", async () => {
  let now = 10;
  const source = await workspace("bounded", "export const value = 1;\n");
  const registry = new SourceDraftPreviewRegistry(() => now);
  for (let index = 0; index < 8; index += 1) {
    registry.register({
      challengeId: `expired-${index}`,
      scope: "app",
      workspace: source,
      changes: [],
      expiresAt: 20,
    });
  }
  expect(registry.liveSize).toBe(8);

  now = 20;
  registry.register({
    challengeId: "current",
    scope: "app",
    workspace: source,
    changes: [],
    expiresAt: 30,
  });

  expect(registry.liveSize).toBe(1);
  await expect(registry.load("expired-0", "shared.file")).resolves.toBeUndefined();
  await expect(registry.load("current", "shared.file")).resolves.toMatchObject({
    source: "export const value = 1;\n",
  });
});

async function workspace(label: string, source: string): Promise<IndexedSourceWorkspace> {
  const root = await realpath(await mkdtemp(join(tmpdir(), `design-space-${label}-preview-`)));
  roots.push(root);
  const absolutePath = join(root, "source.tsx");
  await writeFile(absolutePath, source, "utf8");
  return {
    root,
    manifest: { runtime: "react", sourceRoot: "src", entries: [], devices: [] },
    files: [{ id: "shared.file", relativePath: "src/source.tsx", absolutePath }],
    entryFiles: new Map(),
    stylePaths: [],
  };
}
