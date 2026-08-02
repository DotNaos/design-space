import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { compileTailwindPreview, compileWorkspaceTailwindPreview } from "./tailwind-preview";

describe("target Tailwind preview compiler", () => {
  const context = { projectId: "demo", sources: {}, sourceVersions: {} };

  it("blocks invalid or resource-loading CSS returned by the trusted callback", async () => {
    let output: unknown = "";
    const compiler = () => output as string;
    const unsafeOutputs: unknown[] = [
      42,
      "@import 'https://example.test/theme.css';",
      ".avatar{background:url(https://example.test/a.png)}",
      ".hero{background:image(https://example.test/a.png)}",
      ".hero{background:image-set('a.png' 1x)}",
      ".avatar{background:u\\72l(https://example.test/a.png)}",
      "@im\\70 ort 'https://example.test/theme.css';",
      "</style><script>alert(1)</script>",
      "x".repeat(1_048_577),
    ];

    for (const candidate of unsafeOutputs) {
      output = candidate;
      await expect(compileTailwindPreview("bg-brand-panel", { compile: compiler, context })).rejects.toMatchObject({
        code: "INVALID_TAILWIND",
      });
    }
  });

  it("does not expose errors thrown by the trusted callback", async () => {
    const compiler = () => {
      throw new Error("private target compiler detail");
    };
    await expect(compileTailwindPreview("bg-brand-panel", { compile: compiler, context })).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      message: "The target Tailwind compiler failed",
    });
  });

  it("bounds candidate work before invoking a target compiler", async () => {
    let calls = 0;
    const compiler = () => {
      calls += 1;
      return "";
    };
    await expect(compileTailwindPreview("p-1 p-1", { compile: compiler, context })).rejects.toMatchObject({
      code: "INVALID_TAILWIND",
      message: "Duplicate Tailwind class: p-1",
    });
    const tooMany = Array.from({ length: 257 }, (_, index) => `p-[${index}px]`).join(" ");
    await expect(compileTailwindPreview(tooMany, { compile: compiler, context })).rejects.toMatchObject({
      code: "INVALID_TAILWIND",
      message: "The class list contains too many utilities",
    });
    expect(calls).toBe(0);
  });

  it("compiles the 256-token fallback boundary without accumulating prior candidates", async () => {
    const boundary = Array.from({ length: 256 }, (_, index) => `p-[${index}px]`).join(" ");
    const first = await compileTailwindPreview(boundary);
    expect(first.css).toContain(".p-\\[255px\\]");
    await expect(compileTailwindPreview("definitely-not-a-tailwind-class")).rejects.toMatchObject({
      code: "INVALID_TAILWIND",
      message: "Unknown Tailwind class: definitely-not-a-tailwind-class",
    });
    const isolated = await compileTailwindPreview("m-1");
    expect(isolated.css).toContain(".m-1");
    expect(isolated.css).not.toContain(".p-\\[255px\\]");
  });

  it("compiles source preview utilities from the selected workspace CSS root", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-library-tailwind-"));
    const styles = join(root, "library.css");
    await writeFile(styles, "@theme { --color-library-brand: #123456; }\n@tailwind utilities;\n");
    try {
      const result = await compileWorkspaceTailwindPreview("bg-library-brand", root, [styles]);
      expect(result.css).toContain(".bg-library-brand");
      expect(result.css).toContain("var(--color-library-brand)");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("loads an exported package stylesheet without requiring package.json to be exported", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-library-tailwind-export-"));
    const packageRoot = join(root, "node_modules", "@example", "design");
    const workspaceStyles = join(root, "library.css");
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({
      name: "@example/design",
      exports: { "./styles.css": { style: "./styles.css" } },
    }));
    await writeFile(join(packageRoot, "styles.css"), "@theme { --color-exported-brand: #123456; }\n");
    await writeFile(workspaceStyles, "@import \"@example/design/styles.css\";\n@tailwind utilities;\n");
    try {
      const result = await compileWorkspaceTailwindPreview("bg-exported-brand", root, [workspaceStyles]);
      expect(result.css).toContain(".bg-exported-brand");
      expect(result.css).toContain("var(--color-exported-brand)");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects workspace stylesheets that escape the registered root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "design-space-library-tailwind-boundary-"));
    const root = join(parent, "workspace");
    const outside = join(parent, "outside.css");
    const styles = join(root, "library.css");
    await mkdir(root, { recursive: true });
    await writeFile(outside, "@theme { --color-outside: #123456; }\n");
    await writeFile(styles, `@import ${JSON.stringify(outside)};\n@tailwind utilities;\n`);
    try {
      await expect(compileWorkspaceTailwindPreview("bg-outside", root, [styles])).rejects.toMatchObject({
        code: "COMPILE_ERROR",
      });
    } finally {
      await rm(parent, { force: true, recursive: true });
    }
  });
});
