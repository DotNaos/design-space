import { describe, expect, it } from "vitest";

import { compileTailwindPreview } from "./tailwind-preview";

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
});
