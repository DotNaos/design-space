import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  registerSourceComponentStore,
  SourceComponentCreation,
} from "./source-component-creation";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("source component creation", () => {
  it("prepares an exact new-file diff and creates one typed component folder", async () => {
    const root = await fixture();
    const store = await registerSourceComponentStore(root, "src/app/components", "index.tsx");
    const service = new SourceComponentCreation({
      root,
      store,
      createId: () => "00000000-0000-4000-8000-000000000001",
      now: () => 1_000,
    });

    const prepared = await service.prepare("StatusBadge");
    expect(prepared).toMatchObject({
      state: "source-component-create-ready",
      name: "StatusBadge",
      relativePath: "src/app/components/StatusBadge/index.tsx",
    });
    expect(prepared.diff).toContain("--- /dev/null");
    expect(prepared.diff).toContain("+export interface StatusBadgeProps {");
    expect(prepared.diff).toContain("+  children?: ReactNode;");

    await expect(service.save(prepared.challengeId)).resolves.toEqual({
      state: "source-component-created",
      name: "StatusBadge",
      relativePath: "src/app/components/StatusBadge/index.tsx",
    });
    const source = await readFile(join(root, "src/app/components/StatusBadge/index.tsx"), "utf8");
    expect(source).toContain("export function StatusBadge");
    expect(source).toContain("return <div>{children ?? label}</div>;");
  });

  it("rejects names and destinations that are not server-owned and absent", async () => {
    const root = await fixture();
    const store = await registerSourceComponentStore(root, "src/app/components", "desktop.tsx");
    const service = new SourceComponentCreation({ root, store });

    await expect(service.prepare("../Outside")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await mkdir(join(root, "src/app/components/Existing"));
    await expect(service.prepare("Existing")).rejects.toMatchObject({ code: "STALE_SOURCE" });
  });

  it("requires the registered component directory and expires one-time saves", async () => {
    const root = await fixture();
    const unavailable = new SourceComponentCreation({ root });
    await expect(unavailable.prepare("StatusBadge")).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    let now = 1_000;
    const store = await registerSourceComponentStore(root, "src/app/components", "index.tsx");
    const expiring = new SourceComponentCreation({ root, store, challengeTtlMs: 10, now: () => now });
    const prepared = await expiring.prepare("ExpiredBadge");
    now = 1_011;
    await expect(expiring.save(prepared.challengeId)).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
  });
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "design-space-source-create-"));
  roots.push(root);
  await mkdir(join(root, "src/app/components"), { recursive: true });
  await writeFile(join(root, "src/react.d.ts"), [
    'declare module "react" { export type ReactNode = unknown; }',
    'declare module "react/jsx-runtime" { export const jsx: unknown; export const jsxs: unknown; export const Fragment: unknown; }',
    'declare namespace JSX { interface IntrinsicElements { div: Record<string, unknown>; } }',
    "",
  ].join("\n"));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler", strict: true },
    include: ["src"],
  }));
  return realpath(root);
}
