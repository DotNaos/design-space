import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { assertEditedTypeScriptCompiles } from "./typescript-project-compiler";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("checks the edited source inside its real TypeScript project", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-space-typecheck-"));
  roots.push(root);
  const file = join(root, "view.ts");
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true }, include: ["*.ts"] }));
  await writeFile(file, "export function view() { return 'Ready'; }\n");

  expect(() => assertEditedTypeScriptCompiles(root, file, "export function view() { return 'Updated'; }\n")).not.toThrow();
  expect(() => assertEditedTypeScriptCompiles(root, file, "export function view() { return missingValue; }\n")).toThrowError(
    expect.objectContaining({ code: "COMPILE_ERROR", details: { diagnostic: expect.stringContaining("missingValue") } }),
  );
});
