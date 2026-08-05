import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../app");

const allowedNativeButtons: Readonly<Record<string, number>> = {
  // Roving tree-item focus and branch disclosure are one composite ARIA tree.
  "components/ComponentTree/BranchChevron.tsx": 1,
  "components/ComponentTree/ComponentRow.tsx": 1,
  "components/ComponentTree/TreeRow.tsx": 2,
  // These exact-position hit targets are part of the transformed canvas geometry.
  "components/PreviewCanvas/PreviewCanvas.tsx": 2,
  // The breadcrumb flyout is a compact composite ARIA tree with explorer disclosure.
  "source/SourceCanvasNavigationBranch.tsx": 1,
};

describe("HeroUI primitive boundary", () => {
  it("keeps native buttons limited to documented tree and canvas exceptions", () => {
    expect(nativeTagCounts("button")).toEqual(allowedNativeButtons);
  });

  it.each(["input", "select", "textarea", "dialog"])("does not add a native <%s> control", (tag) => {
    expect(nativeTagCounts(tag)).toEqual({});
  });
});

function nativeTagCounts(tag: string): Record<string, number> {
  return Object.fromEntries(
    sourceFiles(appRoot)
      .map((file) => {
        const matches = readFileSync(file, "utf8").match(new RegExp(`<${tag}\\b`, "g"));
        return [relative(appRoot, file), matches?.length ?? 0] as const;
      })
      .filter(([, count]) => count > 0),
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith(".tsx") || entry.name.includes(".test.")) return [];
    return [path];
  });
}
