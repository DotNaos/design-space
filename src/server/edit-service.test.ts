import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EditService } from "./edit-service";
import {
  registerTrustedTarget,
  validateTargetModule,
  type TrustedTargetConfig,
} from "./target-registration";

const marker = "/* design-space:card.surface */";

async function fixture(overrides: Partial<TrustedTargetConfig> = {}) {
  const root = await mkdtemp(join(tmpdir(), "design-space-server-"));
  const componentPath = join(root, "component.tsx");
  const targetModulePath = join(root, "target.tsx");
  await writeFile(componentPath, `const cardClass = ${marker} "rounded-xl p-4";\n`, "utf8");
  await writeFile(targetModulePath, "export const target = {};\n", "utf8");
  const config: TrustedTargetConfig = {
    project: { id: "demo", label: "Demo" },
    root,
    targetModule: "target.tsx",
    files: { "file.card": "component.tsx" },
    editTargets: {
      "edit.card.surface": { fileId: "file.card", marker },
    },
    ...overrides,
  };
  const registered = await registerTrustedTarget(config);
  return { root, componentPath, config, registered, service: new EditService(registered) };
}

describe("trusted target registration", () => {
  it("rejects traversal paths and symlink escapes", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-root-"));
    const outside = await mkdtemp(join(tmpdir(), "design-space-outside-"));
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeFile(join(outside, "secret.tsx"), "secret\n");
    await symlink(join(outside, "secret.tsx"), join(root, "escape.tsx"));

    const base = {
      project: { id: "demo", label: "Demo" },
      root,
      targetModule: "target.tsx",
      editTargets: {},
    } satisfies Omit<TrustedTargetConfig, "files">;
    await expect(registerTrustedTarget({ ...base, files: { secret: "../secret.tsx" } })).rejects.toMatchObject({
      code: "INVALID_REGISTRATION",
    });
    await expect(registerTrustedTarget({ ...base, files: { secret: "escape.tsx" } })).rejects.toMatchObject({
      code: "ACCESS_DENIED",
    });
  });

  it("requires exactly one trusted marker", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-marker-"));
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeFile(join(root, "component.tsx"), `${marker} "a"; ${marker} "b";\n`);
    await expect(
      registerTrustedTarget({
        project: { id: "demo", label: "Demo" },
        root,
        targetModule: "target.tsx",
        files: { card: "component.tsx" },
        editTargets: { surface: { fileId: "card", marker } },
      }),
    ).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
  });

  it("allows document writes only to unique files inside their registered source set", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-doc-registration-"));
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeFile(join(root, "document.json"), "{}\n");
    const base = {
      project: { id: "demo", label: "Demo" },
      root,
      targetModule: "target.tsx",
      files: { document: "document.json" },
      editTargets: {},
    } satisfies Omit<TrustedTargetConfig, "documentRegistration">;
    const document = {
      sourceFileIds: ["document"],
      writeFileIds: ["unknown"],
      load: () => ({}),
      materialize: () => ({}),
    };
    await expect(registerTrustedTarget({
      ...base,
      documentRegistration: { version: "v1", tailwindClassList: () => "", documents: { screen: document } },
    })).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
    await expect(registerTrustedTarget({
      ...base,
      documentRegistration: {
        version: "v1",
        tailwindClassList: () => "",
        documents: { screen: { ...document, sourceFileIds: ["document", "document"], writeFileIds: ["document"] } },
      },
    })).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
  });

  it("requires an explicit document Tailwind collector at server registration", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-doc-tailwind-registration-"));
    try {
      await writeFile(join(root, "target.tsx"), "export const target = {};\n");
      await writeFile(join(root, "document.json"), "{}\n");
      await expect(registerTrustedTarget({
        project: { id: "demo", label: "Demo" },
        root,
        targetModule: "target.tsx",
        files: { document: "document.json" },
        editTargets: {},
        documentRegistration: {
          version: "v1",
          documents: {},
        },
      } as unknown as TrustedTargetConfig)).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

});

describe("adapter contracts", () => {
  const valid = {
    project: { id: "demo", label: "Demo" },
    defaultAdapterId: "card",
    defaultFixture: { instanceId: "card-instance", adapterId: "card", slots: {} },
    files: [],
    adapters: [
      {
        component: { id: "card", label: "Card", group: "Layout", slots: [] },
        render: () => null,
      },
    ],
  };

  it("accepts explicit slot declarations", () => {
    expect(() => validateTargetModule(valid)).not.toThrow();
  });

  it("rejects missing slots, duplicate adapters, and missing defaults", () => {
    expect(() =>
      validateTargetModule({
        ...valid,
        adapters: [{ component: { id: "card", label: "Card", group: "Layout" }, render: () => null }],
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
    expect(() => validateTargetModule({ ...valid, adapters: [...valid.adapters, ...valid.adapters] })).toThrowError(
      expect.objectContaining({ code: "INVALID_ADAPTER" }),
    );
    expect(() => validateTargetModule({ ...valid, defaultAdapterId: "unknown" })).toThrowError(
      expect.objectContaining({ code: "INVALID_ADAPTER" }),
    );
  });

  it("rejects duplicate fixture instance IDs across sibling branches", () => {
    expect(() =>
      validateTargetModule({
        ...valid,
        defaultFixture: {
          instanceId: "card-instance",
          adapterId: "card",
          slots: {
            body: [
              { kind: "component", node: { instanceId: "copy-instance", adapterId: "copy", slots: {} } },
              { kind: "component", node: { instanceId: "copy-instance", adapterId: "copy", slots: {} } },
            ],
          },
        },
        adapters: [
          {
            component: { id: "card", label: "Card", group: "Layout", slots: [{ id: "body", label: "Body" }] },
            render: () => null,
          },
          {
            component: { id: "copy", label: "Copy", group: "Content", slots: [] },
            render: () => null,
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
  });

  it("accepts only unique target-owned item controls", () => {
    expect(() => validateTargetModule({
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        controls: [{ id: "surface", label: "Classes", kind: "tailwind", prop: "className" }],
      }],
    })).not.toThrow();
    expect(() => validateTargetModule({
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        controls: [
          { id: "surface", label: "Classes", kind: "tailwind", prop: "className" },
          { id: "surface", label: "Other classes", kind: "tailwind", prop: "styleName" },
        ],
      }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
    expect(() => validateTargetModule({
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        controls: [{ id: "unsafe", label: "Unsafe", kind: "command", prop: "shell" }],
      }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
  });

  it("accepts nested internal HTML and rejects duplicate DOM identifiers", () => {
    expect(() => validateTargetModule({
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        component: {
          ...valid.adapters[0].component,
          slots: [{ id: "body", label: "Body" }],
          internalHtml: [{
            id: "card.surface",
            tagName: "article",
            children: [{ id: "card.body", tagName: "div", slotId: "body" }],
          }],
        },
      }],
    })).not.toThrow();
    expect(() => validateTargetModule({
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        component: {
          ...valid.adapters[0].component,
          internalHtml: [{
            id: "card.surface",
            tagName: "article",
            children: [{ id: "card.surface", tagName: "header" }],
          }],
        },
      }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
    expect(() => validateTargetModule({
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        component: {
          ...valid.adapters[0].component,
          internalHtml: [{ id: "card.surface", tagName: "article", slotId: "missing" }],
        },
      }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
  });

  it("validates target-owned document catalogs and component recipes", () => {
    const withDocuments = {
      ...valid,
      adapters: [{
        ...valid.adapters[0],
        component: {
          ...valid.adapters[0].component,
          slots: [{ id: "body", label: "Body" }],
        },
      }],
      defaultDocumentId: "screen.home",
      documents: [{ id: "screen.home", label: "Home", kind: "screen" as const }],
      componentRecipes: [{
        id: "card-recipe",
        label: "Card recipe",
        rootAdapterId: "card",
        rootSlotId: "body",
      }],
    };
    expect(() => validateTargetModule(withDocuments)).not.toThrow();
    expect(() => validateTargetModule({ ...withDocuments, defaultDocumentId: "screen.missing" })).toThrowError(
      expect.objectContaining({ code: "INVALID_ADAPTER" }),
    );
    expect(() => validateTargetModule({
      ...withDocuments,
      documents: [...withDocuments.documents, ...withDocuments.documents],
    })).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
    expect(() => validateTargetModule({
      ...withDocuments,
      componentRecipes: [{ ...withDocuments.componentRecipes[0], rootSlotId: "missing" }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_ADAPTER" }));
  });
});

describe("local edit service", () => {
  it("rejects arbitrary browser paths, commands, fields, and unknown IDs", async () => {
    const { service } = await fixture();
    const attempts = [
      { type: "read-source", editTargetId: "edit.card.surface", path: "/etc/passwd" },
      { type: "read-project-file", fileId: "file.card", path: "/etc/passwd" },
      { type: "prepare-edit", editTargetId: "edit.card.surface", baseVersion: "x", value: "p-2", command: "rm" },
      {
        type: "compile-tailwind",
        value: "p-2",
        compiler: "arbitrary",
        tailwindCompiler: "arbitrary",
        configPath: "/tmp/tailwind.ts",
        sourceFileIds: ["file.card"],
      },
      { type: "run-command", command: "echo unsafe" },
      { type: "prepare-source-component-create", name: "Owned", path: "/tmp/owned.tsx" },
    ];
    for (const attempt of attempts) {
      await expect(service.execute(attempt)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    }
    await expect(service.execute({ type: "read-source", editTargetId: "edit.unknown" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.execute({ type: "read-project-file", fileId: "file.unknown" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reads only a server-registered project file through its opaque ID", async () => {
    const { service } = await fixture();
    await expect(service.execute({ type: "read-project-file", fileId: "file.card" })).resolves.toMatchObject({
      fileId: "file.card",
      label: "component.tsx",
      source: `const cardClass = ${marker} "rounded-xl p-4";\n`,
    });
  });

  it("previews and atomically saves complete TypeScript files only when the source project approved them", async () => {
    const { componentPath, registered, service } = await fixture();
    const snapshot = await service.readProjectFile("file.card");
    await expect(service.execute({
      type: "prepare-project-file-edit",
      fileId: "file.card",
      baseVersion: snapshot.version,
      source: "export const value = 2;\n",
    })).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    const sourceService = new EditService({ ...registered, editableFileIds: new Set(["file.card"]) });
    const nextSource = "export function Card() { return <article>Updated</article>; }\n";
    const prepared = await sourceService.prepareProjectFileEdit("file.card", nextSource, snapshot.version);
    expect(prepared.diff).toContain("+export function Card() { return <article>Updated</article>; }");
    expect(await readFile(componentPath, "utf8")).toContain("rounded-xl p-4");

    const saved = await sourceService.saveProjectFileEdit(prepared.challengeId);
    expect(saved).toMatchObject({ fileId: "file.card", source: nextSource, previousVersion: snapshot.version });
    expect(await readFile(componentPath, "utf8")).toBe(nextSource);
  });

  it("rejects malformed complete TypeScript edits and stale source versions", async () => {
    const { componentPath, registered, service } = await fixture();
    const sourceService = new EditService({ ...registered, editableFileIds: new Set(["file.card"]) });
    const snapshot = await service.readProjectFile("file.card");
    await expect(sourceService.prepareProjectFileEdit("file.card", "export function Broken( {", snapshot.version)).rejects.toMatchObject({
      code: "COMPILE_ERROR",
    });
    await writeFile(componentPath, "export const changed = true;\n", "utf8");
    await expect(sourceService.prepareProjectFileEdit("file.card", "export const next = true;\n", snapshot.version)).rejects.toMatchObject({
      code: "STALE_SOURCE",
    });
  });

  it("rejects unsafe or malformed Tailwind changes", async () => {
    const { service } = await fixture();
    const snapshot = await service.read("edit.card.surface");
    for (const value of ["p-4; process.exit()", "bg-[url('bad')]", "p-[broken", "text-red-500\n<script>", "definitely-not-a-tailwind-utility"]) {
      await expect(service.prepare("edit.card.surface", value, snapshot.version)).rejects.toMatchObject({
        code: "INVALID_TAILWIND",
      });
    }
  });

  it("compiles valid Tailwind classes outside the application source scan", async () => {
    const { service } = await fixture();
    const result = await service.execute({ type: "compile-tailwind", value: "mt-96 bg-red-500 grid-cols-7" });
    expect(result).toMatchObject({ value: "mt-96 bg-red-500 grid-cols-7" });
    expect("css" in result && result.css).toContain(".mt-96");
    expect("css" in result && result.css).toContain(".bg-red-500");
    expect("css" in result && result.css).toContain(".grid-cols-7");
  });

  it("accepts named Tailwind group and peer markers", async () => {
    const { service } = await fixture();
    const value = "group/card peer/draft";
    await expect(service.execute({ type: "compile-tailwind", value })).resolves.toMatchObject({ value });
  });

  it("prepares an exact diff and saves only the marked string", async () => {
    const { componentPath, service } = await fixture();
    const before = await service.read("edit.card.surface");
    const prepared = await service.prepare("edit.card.surface", "rounded-2xl   p-6", before.version);
    expect(prepared.diff).toContain('-const cardClass = /* design-space:card.surface */ "rounded-xl p-4";');
    expect(prepared.diff).toContain('+const cardClass = /* design-space:card.surface */ "rounded-2xl p-6";');
    expect(await readFile(componentPath, "utf8")).toContain('"rounded-xl p-4"');

    const saved = await service.save(prepared.challengeId);
    expect(saved).toMatchObject({ value: "rounded-2xl p-6", previousVersion: before.version });
    expect(await readFile(componentPath, "utf8")).toBe(
      `const cardClass = ${marker} "rounded-2xl p-6";\n`,
    );
  });

  it("rejects stale prepares and concurrent source changes before save", async () => {
    const { componentPath, service } = await fixture();
    const initial = await service.read("edit.card.surface");
    await writeFile(componentPath, `const cardClass = ${marker} "p-8";\n`, "utf8");
    await expect(service.prepare("edit.card.surface", "p-2", initial.version)).rejects.toMatchObject({
      code: "STALE_SOURCE",
    });

    const current = await service.read("edit.card.surface");
    const prepared = await service.prepare("edit.card.surface", "p-10", current.version);
    await writeFile(componentPath, `const cardClass = ${marker} "p-12";\n`, "utf8");
    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(await readFile(componentPath, "utf8")).toContain('"p-12"');
  });

  it("rechecks confinement if a registered file is replaced by a symlink", async () => {
    const { componentPath, service } = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "design-space-swap-"));
    const outsideFile = join(outside, "outside.tsx");
    await writeFile(outsideFile, `const cardClass = ${marker} "p-20";\n`, "utf8");
    await rm(componentPath);
    await symlink(outsideFile, componentPath);
    await expect(service.read("edit.card.surface")).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(service.readProjectFile("file.card")).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("allows recovery after a target compile failure", async () => {
    let shouldFail = true;
    const base = await fixture();
    const registered = await registerTrustedTarget({
      ...base.config,
      editTargets: {
        "edit.card.surface": {
          fileId: "file.card",
          marker,
          compile: () => {
            if (shouldFail) throw new Error("private compiler output");
          },
        },
      },
    });
    const service = new EditService(registered);
    const snapshot = await service.read("edit.card.surface");
    await expect(service.prepare("edit.card.surface", "p-2", snapshot.version)).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      message: "The edited target did not compile",
    });
    shouldFail = false;
    const prepared = await service.prepare("edit.card.surface", "p-2", snapshot.version);
    await expect(service.save(prepared.challengeId)).resolves.toMatchObject({ value: "p-2" });
  });

  it("runs the built-in TSX compiler before issuing a save challenge", async () => {
    const base = await fixture();
    const registered = await registerTrustedTarget({
      ...base.config,
      editTargets: {
        "edit.card.surface": { fileId: "file.card", marker, compiler: "tsx" },
      },
    });
    await writeFile(base.componentPath, `const cardClass = ${marker} "p-4";\n<\n`, "utf8");
    const service = new EditService(registered);
    const snapshot = await service.read("edit.card.surface");
    await expect(service.prepare("edit.card.surface", "p-6", snapshot.version)).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      message: "The edited target did not compile",
    });
  });

  it("expires challenges and serializes competing saves", async () => {
    let now = 1_000;
    const base = await fixture();
    const expiring = new EditService(base.registered, { now: () => now, challengeTtlMs: 50 });
    const snapshot = await expiring.read("edit.card.surface");
    const expired = await expiring.prepare("edit.card.surface", "p-2", snapshot.version);
    now = 1_051;
    await expect(expiring.save(expired.challengeId)).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });

    const service = new EditService(base.registered);
    const fresh = await service.read("edit.card.surface");
    const first = await service.prepare("edit.card.surface", "p-3", fresh.version);
    const second = await service.prepare("edit.card.surface", "p-5", fresh.version);
    const results = await Promise.allSettled([service.save(first.challengeId), service.save(second.challengeId)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
