import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { IndexedSourceWorkspace } from "./source-file-index";
import { EditService } from "./edit-service";
import { sourceVersion } from "./source-editor";
import { SourceChangeSetService } from "./source-change-set-service";
import { SourceDraftPreviewRegistry } from "./source-draft-preview-registry";
import type { RegisteredFile, RegisteredTarget } from "./target-registration";

interface Fixture {
  appRoot: string;
  libraryRoot: string;
  appFiles: { a: RegisteredFile; b: RegisteredFile };
  libraryFiles: { a: RegisteredFile; b: RegisteredFile };
  target: RegisteredTarget;
}

interface StrictUiFixture extends Fixture {
  strictFiles: { contracts: RegisteredFile; usage: RegisteredFile };
  strictSources: { contracts: string; usage: string };
}

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<Fixture> {
  const appRoot = await realpath(await mkdtemp(join(tmpdir(), "design-space-change-set-app-")));
  const libraryRoot = await realpath(await mkdtemp(join(tmpdir(), "design-space-change-set-library-")));
  temporaryRoots.push(appRoot, libraryRoot);
  const appFiles = await writeProject(appRoot, "app");
  const libraryFiles = await writeProject(libraryRoot, "library");
  const appWorkspace = workspace(appRoot, appFiles);
  const libraryWorkspace = workspace(libraryRoot, libraryFiles);
  const target: RegisteredTarget = {
    project: { id: "demo", label: "Demo" },
    root: appRoot,
    targetModulePath: join(appRoot, ".designspace.ts"),
    files: new Map(Object.values(appFiles).map((file) => [file.id, file])),
    editTargets: new Map(),
    editableFileIds: new Set(Object.values(appFiles).map((file) => file.id)),
    sourceWorkspace: appWorkspace,
    sourceLibrary: { packageName: "@demo/ui", development: libraryWorkspace },
  };
  return { appRoot, libraryRoot, appFiles, libraryFiles, target };
}

async function writeProject(root: string, prefix: string) {
  await mkdir(join(root, "src"), { recursive: true });
  await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      jsx: "react-jsx",
      strict: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      target: "ES2022",
      skipLibCheck: true,
    },
    include: ["src"],
  }), "utf8");
  await writeFile(join(root, ".designspace.ts"), "export default {};\n", "utf8");
  await writeFile(join(root, "src/a.ts"), "export const value: number = 1;\n", "utf8");
  await writeFile(join(root, "src/b.ts"), 'import { value } from "./a";\nexport const result: number = value;\n', "utf8");
  return {
    a: { id: `${prefix}.a`, path: join(root, "src/a.ts"), displayName: "src/a.ts" },
    b: { id: `${prefix}.b`, path: join(root, "src/b.ts"), displayName: "src/b.ts" },
  } satisfies Record<string, RegisteredFile>;
}

async function strictUiFixture(): Promise<StrictUiFixture> {
  const base = await fixture();
  const strictSources = {
    contracts: `
      import type { ReactElement } from "react";
      export type ComponentSlot<T> = ReactElement & { readonly __accepts?: T };
      export function Heading() { return <h2>Heading</h2>; }
      export function Card() { return <article>Card</article>; }
      export interface PanelProps {
        slots: { header: ComponentSlot<typeof Heading> };
        children?: never;
      }
      export function Panel({ slots }: PanelProps) {
        return <section>{slots.header}</section>;
      }
    `,
    usage: `
      import { Heading, Panel } from "./strict-contracts";
      export function StrictApp() {
        return <Panel slots={{ header: <Heading /> }} />;
      }
    `,
  };
  const strictFiles = {
    contracts: {
      id: "app.strict-contracts",
      path: join(base.appRoot, "src/strict-contracts.tsx"),
      displayName: "src/strict-contracts.tsx",
    },
    usage: {
      id: "app.strict-usage",
      path: join(base.appRoot, "src/strict-usage.tsx"),
      displayName: "src/strict-usage.tsx",
    },
  } satisfies Record<string, RegisteredFile>;
  await writeFile(strictFiles.contracts.path, strictSources.contracts, "utf8");
  await writeFile(strictFiles.usage.path, strictSources.usage, "utf8");
  const files = new Map(base.target.files);
  const editableFileIds = new Set(base.target.editableFileIds);
  for (const file of Object.values(strictFiles)) {
    files.set(file.id, file);
    editableFileIds.add(file.id);
  }
  const sourceWorkspace = base.target.sourceWorkspace;
  if (!sourceWorkspace) throw new Error("Expected an app source workspace");
  return {
    ...base,
    strictFiles,
    strictSources,
    target: {
      ...base.target,
      files,
      editableFileIds,
      sourceWorkspace: workspace(base.appRoot, Object.fromEntries(files)),
    },
  };
}

function workspace(root: string, files: Record<string, RegisteredFile>): IndexedSourceWorkspace {
  return {
    root,
    manifest: { runtime: "react", sourceRoot: "src", entries: [], devices: [] },
    files: Object.values(files).map((file) => ({
      id: file.id,
      relativePath: file.displayName,
      absolutePath: file.path,
    })),
    entryFiles: new Map(),
    stylePaths: [],
  };
}

async function draft(file: RegisteredFile, source: string) {
  const current = await readFile(file.path, "utf8");
  return { fileId: file.id, baseVersion: sourceVersion(current), source };
}

describe("source change-set service", () => {
  it("returns authoritative review evidence before atomically applying multiple files", async () => {
    const base = await fixture();
    const service = new SourceChangeSetService(base.target);
    const nextA = 'export const value: string = "next";\n';
    const nextB = 'import { value } from "./a";\nexport const result: string = value;\n';
    const prepared = await service.prepare("app", [
      await draft(base.appFiles.a, nextA),
      await draft(base.appFiles.b, nextB),
    ]);

    expect(prepared).toMatchObject({
      state: "source-change-set-ready",
      scope: "app",
      changes: [
        { changeId: "app.a", fileId: "app.a", label: "src/a.ts", afterSource: nextA },
        { changeId: "app.b", fileId: "app.b", label: "src/b.ts", afterSource: nextB },
      ],
    });
    expect(prepared.changes[0]?.beforeSource).toContain("number = 1");
    expect(prepared.changes[0]?.diff).toContain("+export const value: string");
    await expect(readFile(base.appFiles.a.path, "utf8")).resolves.toContain("number = 1");

    await expect(service.apply(prepared.challengeId)).resolves.toMatchObject({
      state: "source-change-set-applied",
      scope: "app",
      changes: [{ fileId: "app.a" }, { fileId: "app.b" }],
    });
    await expect(readFile(base.appFiles.a.path, "utf8")).resolves.toBe(nextA);
    await expect(readFile(base.appFiles.b.path, "utf8")).resolves.toBe(nextB);
    await expect(service.apply(prepared.challengeId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps app and development-library roots as separate transactions", async () => {
    const base = await fixture();
    const service = new SourceChangeSetService(base.target);
    const next = "export const value: number = 2;\n";
    const prepared = await service.prepare("library-development", [await draft(base.libraryFiles.a, next)]);
    await service.apply(prepared.challengeId);

    await expect(readFile(base.libraryFiles.a.path, "utf8")).resolves.toBe(next);
    await expect(readFile(base.appFiles.a.path, "utf8")).resolves.toContain("number = 1");
  });

  it("validates the complete draft set together and rejects a broken dependent file", async () => {
    const base = await fixture();
    const service = new SourceChangeSetService(base.target);
    await expect(service.prepare("app", [
      await draft(base.appFiles.a, 'export const value: string = "broken";\n'),
    ])).rejects.toMatchObject({ code: "COMPILE_ERROR" });
    await expect(service.prepare("app", [
      await draft(base.appFiles.a, "export const = ;\n"),
    ])).rejects.toMatchObject({ code: "COMPILE_ERROR" });
  });

  it("rejects missing and incompatible typed-slot drafts before issuing a challenge", async () => {
    const base = await strictUiFixture();
    const service = new SourceChangeSetService(base.target, { createId: () => "must-not-be-issued" });
    const missing = `
      import { Panel, type PanelProps } from "./strict-contracts";
      export function StrictApp() {
        return <Panel slots={{} as PanelProps["slots"]} />;
      }
    `;
    await expect(service.prepare("app", [
      await draft(base.strictFiles.usage, missing),
    ])).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      message: expect.stringContaining("Slot header requires at least 1 compatible component"),
    });

    const incompatible = `
      import { Card, Panel } from "./strict-contracts";
      export function StrictApp() {
        return <Panel slots={{ header: <Card /> }} />;
      }
    `;
    await expect(service.prepare("app", [
      await draft(base.strictFiles.usage, incompatible),
    ])).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      message: expect.stringContaining("accepts Heading but received Card"),
    });
    await expect(service.apply("must-not-be-issued")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates related contract and consumer drafts in the same compiler view", async () => {
    const base = await strictUiFixture();
    const service = new SourceChangeSetService(base.target);
    const nextContracts = base.strictSources.contracts.replace(
      "ComponentSlot<typeof Heading>",
      "ComponentSlot<typeof Card>",
    );
    const nextUsage = base.strictSources.usage
      .replace("Heading, Panel", "Card, Panel")
      .replace("<Heading />", "<Card />");

    await expect(service.prepare("app", [
      await draft(base.strictFiles.contracts, nextContracts),
      await draft(base.strictFiles.usage, nextUsage),
    ])).resolves.toMatchObject({
      state: "source-change-set-ready",
      changes: [
        { fileId: base.strictFiles.contracts.id },
        { fileId: base.strictFiles.usage.id },
      ],
    });

    await expect(service.prepare("app", [
      await draft(base.strictFiles.contracts, nextContracts),
    ])).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      message: expect.stringContaining("accepts Card but received Heading"),
    });
  });

  it("rejects duplicate, unknown, unregistered, and unchanged files", async () => {
    const base = await fixture();
    const service = new SourceChangeSetService(base.target);
    const change = await draft(base.appFiles.a, "export const value: number = 2;\n");
    await expect(service.prepare("app", [change, change])).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.prepare("app", [{ ...change, fileId: "unknown.file" }])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const current = await readFile(base.appFiles.a.path, "utf8");
    await expect(service.prepare("app", [{
      fileId: base.appFiles.a.id,
      baseVersion: sourceVersion(current),
      source: current,
    }])).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const unregisteredTarget = { ...base.target, editableFileIds: new Set<string>() };
    await expect(new SourceChangeSetService(unregisteredTarget).prepare("app", [change])).rejects.toMatchObject({
      code: "ACCESS_DENIED",
    });
  });

  it("rechecks every version and rolls back a failed installation", async () => {
    const base = await fixture();
    const service = new SourceChangeSetService(base.target);
    const nextA = "export const value: number = 2;\n";
    const nextB = 'import { value } from "./a";\nexport const result: number = value + 1;\n';
    const stale = await service.prepare("app", [
      await draft(base.appFiles.a, nextA),
      await draft(base.appFiles.b, nextB),
    ]);
    await writeFile(base.appFiles.b.path, `${await readFile(base.appFiles.b.path, "utf8")}\n`, "utf8");
    await expect(service.apply(stale.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    await expect(readFile(base.appFiles.a.path, "utf8")).resolves.toContain("number = 1");

    await writeFile(base.appFiles.b.path, 'import { value } from "./a";\nexport const result: number = value;\n');
    const failing = new SourceChangeSetService(base.target, {
      transactionHooks: { afterInstall: () => { throw new Error("simulated failure"); } },
    });
    const prepared = await failing.prepare("app", [
      await draft(base.appFiles.a, nextA),
      await draft(base.appFiles.b, nextB),
    ]);
    await expect(failing.apply(prepared.challengeId)).rejects.toMatchObject({ code: "TRANSACTION_FAILED" });
    await expect(readFile(base.appFiles.a.path, "utf8")).resolves.toContain("number = 1");
    await expect(readFile(base.appFiles.b.path, "utf8")).resolves.toContain("result: number = value;");
  });

  it("expires one-time review challenges", async () => {
    const base = await fixture();
    let now = 1_000;
    const service = new SourceChangeSetService(base.target, { now: () => now, challengeTtlMs: 50 });
    const prepared = await service.prepare("app", [
      await draft(base.appFiles.a, "export const value: number = 2;\n"),
    ]);
    now += 51;
    await expect(service.apply(prepared.challengeId)).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
    await expect(service.apply(prepared.challengeId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps repeated superseding prepares bounded and revokes their prepared previews", async () => {
    const base = await fixture();
    const registry = new SourceDraftPreviewRegistry(() => 1_000);
    let sequence = 0;
    const service = new SourceChangeSetService(base.target, {
      createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
      maximumLiveChallenges: 1,
      now: () => 1_000,
      previewRegistry: registry,
    });
    const change = await draft(base.appFiles.a, "export const value: number = 2;\n");
    let previous: string | undefined;
    const revoked: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const prepared = await service.prepare("app", [change], previous);
      if (previous) revoked.push(previous);
      previous = prepared.challengeId;
      expect(registry.liveSize).toBe(1);
    }

    for (const challengeId of revoked) {
      await expect(service.apply(challengeId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(registry.load(challengeId, base.appFiles.a.id)).resolves.toBeUndefined();
    }
    await expect(service.apply(previous!)).resolves.toMatchObject({ state: "source-change-set-applied" });
    expect(registry.liveSize).toBe(0);
  }, 15_000);

  it("does not let an app prepare supersede a development-library challenge", async () => {
    const base = await fixture();
    const service = new SourceChangeSetService(base.target, { maximumLiveChallenges: 2 });
    const library = await service.prepare("library-development", [
      await draft(base.libraryFiles.a, "export const value: number = 2;\n"),
    ]);
    await service.prepare("app", [
      await draft(base.appFiles.a, "export const value: number = 2;\n"),
    ], library.challengeId);

    await expect(service.apply(library.challengeId)).resolves.toMatchObject({
      state: "source-change-set-applied",
      scope: "library-development",
    });
  }, 10_000);
});

describe("source change-set browser contract", () => {
  it("uses the attached library CSS root for library Tailwind previews", async () => {
    const base = await fixture();
    const stylesheet = join(base.libraryRoot, "src/library.css");
    await writeFile(stylesheet, "@theme { --color-library-brand: #123456; }\n@tailwind utilities;\n");
    const development = base.target.sourceLibrary?.development;
    if (!development) throw new Error("Expected a development library");
    const service = new EditService({
      ...base.target,
      sourceLibrary: {
        ...base.target.sourceLibrary!,
        development: { ...development, stylePaths: [stylesheet] },
      },
    });

    await expect(service.execute({
      type: "compile-tailwind",
      scope: "library-development",
      value: "bg-library-brand",
    })).resolves.toMatchObject({ value: "bg-library-brand", css: expect.stringContaining("var(--color-library-brand)") });
    await expect(service.execute({
      type: "compile-tailwind",
      scope: "app",
      value: "bg-library-brand",
    })).rejects.toMatchObject({ code: "INVALID_TAILWIND" });
  });

  it("supports scoped library reads and draft analysis without exposing release files", async () => {
    const base = await fixture();
    const service = new EditService(base.target);
    await expect(service.execute({
      type: "read-project-file",
      scope: "library-development",
      fileId: base.libraryFiles.a.id,
    })).resolves.toMatchObject({ fileId: "library.a", source: expect.stringContaining("number = 1") });
    await expect(service.execute({
      type: "analyze-source-file-draft",
      scope: "library-development",
      fileId: base.libraryFiles.a.id,
      source: "export const value: number = 2;\n",
    })).resolves.toEqual({ fileId: "library.a", components: [] });
    await expect(service.execute({
      type: "read-project-file",
      scope: "release",
      fileId: base.libraryFiles.a.id,
    })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("accepts only opaque IDs and applies only a server-issued challenge", async () => {
    const base = await fixture();
    const service = new EditService(base.target);
    const change = await draft(base.appFiles.a, "export const value: number = 2;\n");
    await expect(service.execute({
      type: "prepare-source-change-set",
      scope: "app",
      changes: [{ ...change, path: "/etc/passwd" }],
    })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const prepared = await service.execute({
      type: "prepare-source-change-set",
      scope: "app",
      changes: [change],
    });
    expect(prepared).toMatchObject({ state: "source-change-set-ready" });
    if (!("challengeId" in prepared)) throw new Error("Expected a prepared challenge");
    await expect(service.execute({
      type: "apply-source-change-set",
      challengeId: prepared.challengeId,
      changes: [change],
    })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(service.execute({
      type: "apply-source-change-set",
      challengeId: prepared.challengeId,
    })).resolves.toMatchObject({ state: "source-change-set-applied" });
  });

  it("accepts a scoped superseding challenge through the browser contract", async () => {
    const base = await fixture();
    const service = new EditService(base.target);
    const change = await draft(base.appFiles.a, "export const value: number = 2;\n");
    const first = await service.execute({ type: "prepare-source-change-set", scope: "app", changes: [change] });
    if (!("challengeId" in first)) throw new Error("Expected a prepared challenge");
    const second = await service.execute({
      type: "prepare-source-change-set",
      scope: "app",
      supersedesChallengeId: first.challengeId,
      changes: [change],
    });
    if (!("challengeId" in second)) throw new Error("Expected a superseding challenge");

    await expect(service.execute({
      type: "apply-source-change-set",
      challengeId: first.challengeId,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.execute({
      type: "apply-source-change-set",
      challengeId: second.challengeId,
    })).resolves.toMatchObject({ state: "source-change-set-applied" });
  }, 10_000);
});
