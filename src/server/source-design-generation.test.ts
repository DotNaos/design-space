import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";

import { indexSourceWorkspace } from "./source-file-index";
import { SourceDesignGeneration } from "./source-design-generation";
import type { RegisteredTarget } from "./target-registration";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))));

it("creates a compiled colocated design from compiler-derived props", async () => {
  const root = await fixtureRoot();
  const workspace = await indexSourceWorkspace(root, {
    project: { id: "design-generator", label: "Design generator" },
    source: { layout: "src/app/components/Panel/index.tsx" },
  });
  const entry = workspace.manifest.entries.find((candidate) => candidate.exportName === "Panel");
  expect(entry).toBeDefined();
  const target: RegisteredTarget = {
    project: { id: "design-generator", label: "Design generator" },
    root,
    targetModulePath: join(root, ".designspace.ts"),
    files: new Map(),
    editTargets: new Map(),
    sourceWorkspace: workspace,
  };

  const result = await new SourceDesignGeneration(target).generate("app", entry!.id);
  expect(result.relativePath).toBe("src/app/components/Panel/index.design.tsx");
  const source = await readFile(join(root, result.relativePath), "utf8");
  expect(source).toContain('import { Panel as ComponentUnderDesign } from "./index";');
  expect(source).toContain("title: \"\"");
  expect(source).toContain("enabled: false");
  expect(source).toContain("onSelect: () => undefined");
  expect(source).toContain("as unknown as ComponentProps<typeof ComponentUnderDesign>");
  expect(source).toContain('import target from "virtual:design-space-target";');
  expect(source).toContain('entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/components/Panel/index.tsx" && entry.exportName === "Panel")');
  expect(source).toContain('background: "#141518"');
  expect(source).toContain("minHeight: 360");
  expect(source).toContain('width: "min(100%, 640px)"');
  expect(source).toContain("designs: { default: {} }");
});

it("creates a prop-free design for a component without a props parameter", async () => {
  const root = await fixtureRoot();
  const workspace = await indexSourceWorkspace(root, {
    project: { id: "design-generator", label: "Design generator" },
    source: { layout: "src/app/components/Panel/index.tsx" },
  });
  const entry = workspace.manifest.entries.find((candidate) => candidate.exportName === "Plain")!;
  const target = {
    project: { id: "design-generator", label: "Design generator" }, root,
    targetModulePath: join(root, ".designspace.ts"), files: new Map(), editTargets: new Map(), sourceWorkspace: workspace,
  } satisfies RegisteredTarget;

  const result = await new SourceDesignGeneration(target).generate("app", entry.id);
  const source = await readFile(join(root, result.relativePath), "utf8");

  expect(source).not.toContain("ComponentProps");
  expect(source).toContain("defaults: {}");
  expect(source).toContain("render: () => <ComponentUnderDesign />");
});

it("never overwrites an existing generated design", async () => {
  const root = await fixtureRoot();
  const workspace = await indexSourceWorkspace(root, {
    project: { id: "design-generator", label: "Design generator" },
    source: { layout: "src/app/components/Panel/index.tsx" },
  });
  const entry = workspace.manifest.entries.find((candidate) => candidate.exportName === "Panel")!;
  const target = {
    project: { id: "design-generator", label: "Design generator" }, root,
    targetModulePath: join(root, ".designspace.ts"), files: new Map(), editTargets: new Map(), sourceWorkspace: workspace,
  } satisfies RegisteredTarget;
  const generator = new SourceDesignGeneration(target);
  await generator.generate("app", entry.id);
  await expect(generator.generate("app", entry.id)).rejects.toMatchObject({ code: "STALE_SOURCE" });
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "design-space-design-generation-"));
  roots.push(root);
  await mkdir(join(root, "src/app/components/Panel"), { recursive: true });
  await mkdir(join(root, "src/shared"), { recursive: true });
  await writeFile(join(root, ".designspace.ts"), "export default {};\n");
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler", target: "ES2022" },
    include: ["src"],
  }));
  await writeFile(join(root, "src/react.d.ts"), [
    'declare module "react" { export type ComponentProps<T> = T extends (props: infer P) => unknown ? P : never; }',
    'declare module "react/jsx-runtime" { export const jsx: unknown; export const jsxs: unknown; export const Fragment: unknown; }',
    'declare module "virtual:design-space-target" { const target: { sourceWorkspace?: { entries: readonly { relativePath: string; exportName: string }[] } }; export default target; }',
    'declare namespace JSX { interface IntrinsicElements { div: Record<string, unknown>; } }',
  ].join("\n"));
  await writeFile(join(root, "src/shared/component-design.ts"), [
    "export function defineComponentDesign<C, O>(component: C, options: O) {",
    "  return { component, ...options };",
    "}",
  ].join("\n"));
  await writeFile(join(root, "src/app/components/Panel/index.tsx"), [
    "export interface SourceWorkspaceEntry { relativePath: string; exportName: string; }",
    "export interface PanelProps { title: string; enabled: boolean; onSelect: () => void; children: unknown; entry?: SourceWorkspaceEntry; }",
    "export function Panel(props: PanelProps) {",
    "  return <div>{props.title}</div>;",
    "}",
  ].join("\n"));
  await writeFile(join(root, "src/app/components/Panel/Plain.tsx"), [
    "export function Plain() {",
    "  return <div>Plain</div>;",
    "}",
  ].join("\n"));
  return root;
}
