import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { targetTypeScriptAliases } from "./typescript-path-aliases";

describe("target TypeScript aliases", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  it("uses the target application config without exposing arbitrary browser paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-aliases-"));
    roots.push(root);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "tsconfig.app.json"), JSON.stringify({
      compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
    }));

    const aliases = targetTypeScriptAliases(root);
    expect(aliases).toHaveLength(1);
    expect((aliases[0].find as RegExp).test("@/app/app")).toBe(true);
    expect(aliases[0].replacement).toBe(`${join(root, "src")}/`);
  });
});
