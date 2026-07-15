import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { isFileLoadingAllowed, resolveConfig } from "vite";

import { createViteFileSystemPolicy, DESIGN_SPACE_FILE_SYSTEM_DENY } from "./vite-file-system-policy";

describe("Vite file-system boundary", () => {
  it("denies the server-only Tailwind language-server package", async () => {
    expect(DESIGN_SPACE_FILE_SYSTEM_DENY).toContain("**/@tailwindcss/language-server/**");
    const root = "/design-space";
    const policy = createViteFileSystemPolicy(root, "/target/entry.tsx");
    expect(policy).toMatchObject({
      strict: true,
      allow: [root, "/target/entry.tsx"],
      deny: expect.arrayContaining(["**/@tailwindcss/language-server/**"]),
    });
    const config = await resolveConfig({ configFile: false, logLevel: "silent", root, server: { fs: policy } }, "serve");
    expect(isFileLoadingAllowed(
      config,
      join(root, "node_modules/@tailwindcss/language-server/bin/tailwindcss-language-server"),
    )).toBe(false);
    expect(isFileLoadingAllowed(config, join(root, "src/app/App.tsx"))).toBe(true);
  });
});
