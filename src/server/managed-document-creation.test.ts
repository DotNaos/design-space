import { lstat, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { designDocumentSchema, type DesignDocument } from "../shared/design-document";
import type { StrictUiViolation } from "../shared/strict-ui";
import { DocumentService } from "./document-service";
import { EditService } from "./edit-service";
import { registerTrustedTarget, type TrustedTargetConfig } from "./target-registration";

const firstUuid = "11111111-1111-4111-8111-111111111111";
const secondUuid = "22222222-2222-4222-8222-222222222222";

describe("target-owned managed document creation", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  async function fixture(overrides: Partial<TrustedTargetConfig["documentRegistration"]> = {}) {
    const root = await mkdtemp(join(tmpdir(), "design-space-managed-"));
    roots.push(root);
    await mkdir(join(root, "managed"));
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    const state: { compileFails: boolean; violations: StrictUiViolation[] } = { compileFails: false, violations: [] };
    const config: TrustedTargetConfig = {
      project: { id: "managed-test", label: "Managed test" },
      root,
      targetModule: "target.tsx",
      files: {},
      editTargets: {},
      documentRegistration: {
        version: "managed.v1",
        tailwindClassList: () => "",
        documents: {},
        managed: {
          directory: "managed",
          recipes: {
            "blank-screen": {
              label: "Blank screen",
              kind: "screen",
              create: ({ documentId, label }) => makeDocument(documentId, label, "screen"),
            },
            "stack-component": {
              label: "Stack component",
              description: "One explicit content outlet",
              kind: "component",
              create: ({ documentId, label }) => makeDocument(documentId, label, "component"),
            },
          },
          strictUi: () => state.violations,
          compile: (sources) => {
            if (state.compileFails) throw new Error("private compile detail");
            for (const source of Object.values(sources)) designDocumentSchema.parse(JSON.parse(source));
          },
        },
        ...overrides,
      },
    };
    const registered = await registerTrustedTarget(config);
    return { config, registered, root, state };
  }

  it("prepares an exact new-file diff, persists once, and discovers the document after restart", async () => {
    const { config, registered, root } = await fixture();
    const service = new DocumentService(registered, { createManagedDocumentId: () => firstUuid });
    await expect(service.list()).resolves.toMatchObject({
      state: "catalog",
      documents: [],
      recipes: [
        { id: "blank-screen", kind: "screen" },
        { id: "stack-component", kind: "component" },
      ],
      files: [],
    });

    const prepared = await service.execute({
      type: "prepare-document-create",
      recipeId: "blank-screen",
      label: "  Settings  ",
    });
    expect(prepared).toMatchObject({
      state: "create-ready",
      documentId: `screen.${firstUuid}`,
      createdDocument: { label: "Settings", kind: "screen" },
      changes: [{ beforeVersion: null, label: `managed/${firstUuid}.design.json` }],
      strictUi: { status: "passed" },
      compile: { status: "passed" },
    });
    if (!("state" in prepared) || prepared.state !== "create-ready") throw new Error("Expected a prepared creation");
    expect(prepared.diff).toContain("--- /dev/null");
    expect(prepared.diff).toContain(`+++ b/managed/${firstUuid}.design.json`);
    expect(prepared.diff).toContain('+  "label": "Settings",');
    await expect(lstat(join(root, "managed", `${firstUuid}.design.json`))).rejects.toMatchObject({ code: "ENOENT" });

    await expect(service.execute({ type: "save-document", challengeId: prepared.challengeId })).resolves.toMatchObject({
      state: "saved",
      documentId: `screen.${firstUuid}`,
      previousDocumentDigest: null,
    });
    await expect(service.execute({ type: "save-document", challengeId: prepared.challengeId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(JSON.parse(await readFile(join(root, "managed", `${firstUuid}.design.json`), "utf8"))).toMatchObject({
      id: `screen.${firstUuid}`,
      label: "Settings",
    });
    await expect(new EditService(registered).readProjectFile(`managed.${firstUuid}`)).resolves.toMatchObject({
      fileId: `managed.${firstUuid}`,
      label: `managed/${firstUuid}.design.json`,
      source: expect.stringContaining('"label": "Settings"'),
    });
    await expect(service.list()).resolves.toMatchObject({
      documents: [{ id: `screen.${firstUuid}`, label: "Settings", origin: "managed" }],
      files: [{ kind: "directory", label: "managed" }, { id: `managed.${firstUuid}`, kind: "file", label: `${firstUuid}.design.json` }],
    });

    const restarted = new DocumentService(await registerTrustedTarget(config));
    await expect(restarted.list()).resolves.toMatchObject({
      documents: [{ id: `screen.${firstUuid}`, label: "Settings", origin: "managed" }],
    });
    await expect(restarted.read(`screen.${firstUuid}`)).resolves.toMatchObject({ document: { label: "Settings" } });
  });

  it("never clobbers a file created after preparation", async () => {
    const { registered, root } = await fixture();
    const service = new DocumentService(registered, { createManagedDocumentId: () => secondUuid });
    const prepared = await service.prepareCreate("blank-screen", "Competing");
    if (prepared.state !== "create-ready") throw new Error("Expected a prepared creation");
    const path = join(root, "managed", `${secondUuid}.design.json`);
    await writeFile(path, "external owner\n");
    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(await readFile(path, "utf8")).toBe("external owner\n");
    expect((await readdir(join(root, "managed"))).filter((name) => name.includes(".design-space-"))).toEqual([]);
  });

  it("creates component documents with their explicit target-owned outlet", async () => {
    const { registered } = await fixture();
    const service = new DocumentService(registered, { createManagedDocumentId: () => secondUuid });
    const prepared = await service.prepareCreate("stack-component", "Notice panel");
    expect(prepared).toMatchObject({
      state: "create-ready",
      createdDocument: {
        id: `component.${secondUuid}`,
        kind: "component",
        component: { label: "Notice panel", slots: [{ id: "content" }] },
        root: { slots: { content: [{ kind: "slot-outlet", slotId: "content" }] } },
      },
    });
  });

  it("returns Strict UI and compile blocks without creating a destination", async () => {
    const strict = await fixture();
    strict.state.violations = [{
      ruleId: "screen.required",
      severity: "error",
      message: "A required target rule failed",
      location: { kind: "document" },
    }];
    const strictService = new DocumentService(strict.registered, { createManagedDocumentId: () => firstUuid });
    await expect(strictService.prepareCreate("blank-screen", "Blocked")).resolves.toMatchObject({ state: "strict-blocked" });
    await expect(lstat(join(strict.root, "managed", `${firstUuid}.design.json`))).rejects.toMatchObject({ code: "ENOENT" });

    const compile = await fixture();
    compile.state.compileFails = true;
    const compileService = new DocumentService(compile.registered, { createManagedDocumentId: () => secondUuid });
    await expect(compileService.prepareCreate("blank-screen", "Broken")).resolves.toMatchObject({ state: "compile-blocked" });
    await expect(lstat(join(compile.root, "managed", `${secondUuid}.design.json`))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("validates target-owned Tailwind during managed creation", async () => {
    const invalid = await fixture({ tailwindClassList: () => "not-a-real-design-space-utility" });
    const service = new DocumentService(invalid.registered, { createManagedDocumentId: () => firstUuid });

    await expect(service.prepareCreate("blank-screen", "Invalid Tailwind"))
      .resolves.toMatchObject({ state: "compile-blocked" });
    await expect(lstat(join(invalid.root, "managed", `${firstUuid}.design.json`)))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("enforces the 500-document limit at prepare and again at save", async () => {
    const full = await fixture();
    fillDocumentCatalog(full.registered, 500);
    const fullService = new DocumentService(full.registered, { createManagedDocumentId: () => firstUuid });
    await expect(fullService.prepareCreate("blank-screen", "Over capacity"))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const concurrent = await fixture();
    const service = new DocumentService(concurrent.registered, { createManagedDocumentId: () => secondUuid });
    const prepared = await service.prepareCreate("blank-screen", "Competing capacity");
    if (prepared.state !== "create-ready") throw new Error("Expected a prepared creation");
    fillDocumentCatalog(concurrent.registered, 500);
    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(lstat(join(concurrent.root, "managed", `${secondUuid}.design.json`)))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a managed-directory swap without writing through the replacement", async () => {
    const { registered, root } = await fixture();
    const service = new DocumentService(registered, { createManagedDocumentId: () => firstUuid });
    const prepared = await service.prepareCreate("blank-screen", "Unsafe");
    if (prepared.state !== "create-ready") throw new Error("Expected a prepared creation");
    const outside = await mkdtemp(join(tmpdir(), "design-space-managed-outside-"));
    roots.push(outside);
    await rename(join(root, "managed"), join(root, "managed-original"));
    await symlink(outside, join(root, "managed"));

    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects unregistered recipes and invalid target-owned recipe output", async () => {
    const { registered } = await fixture({
      managed: {
        directory: "managed",
        recipes: {
          broken: {
            label: "Broken",
            kind: "screen",
            create: () => makeDocument("screen.wrong", "Wrong", "screen"),
          },
        },
      },
    });
    const service = new DocumentService(registered, { createManagedDocumentId: () => firstUuid });
    await expect(service.prepareCreate("missing", "Missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.prepareCreate("broken", "Broken")).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
  });

  it("rejects matching symlinks and traversal in the server registration", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-managed-registration-"));
    const outside = await mkdtemp(join(tmpdir(), "design-space-managed-registration-outside-"));
    roots.push(root, outside);
    await mkdir(join(root, "managed"));
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeFile(join(outside, "outside.json"), JSON.stringify(makeDocument(`screen.${firstUuid}`, "Outside", "screen")));
    await symlink(join(outside, "outside.json"), join(root, "managed", `${firstUuid}.design.json`));

    await expect(registerTrustedTarget(managedConfig(root, "managed"))).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(registerTrustedTarget(managedConfig(root, "../outside"))).rejects.toMatchObject({
      code: "INVALID_REGISTRATION",
    });
  });
});

function managedConfig(root: string, directory: string): TrustedTargetConfig {
  return {
    project: { id: "managed-test", label: "Managed test" },
    root,
    targetModule: "target.tsx",
    files: {},
    editTargets: {},
    documentRegistration: {
      version: "managed.v1",
      tailwindClassList: () => "",
      documents: {},
      managed: {
        directory,
        recipes: {
          blank: {
            label: "Blank",
            kind: "screen",
            create: ({ documentId, label }) => makeDocument(documentId, label, "screen"),
          },
        },
      },
    },
  };
}

function makeDocument(documentId: string, label: string, kind: "screen" | "component"): DesignDocument {
  const uuid = documentId.slice(documentId.indexOf(".") + 1);
  if (kind === "screen") {
    return {
      schemaVersion: 2,
      id: documentId,
      label,
      kind,
      root: { instanceId: `screen-root-${uuid}`, adapterId: "stack", slots: { content: [] } },
    };
  }
  return {
    schemaVersion: 2,
    id: documentId,
    label,
    kind,
    component: {
      id: `authored-${uuid}`,
      label,
      group: "Custom",
      properties: [],
      slots: [{ id: "content", label: "Content" }],
    },
    root: {
      instanceId: `component-root-${uuid}`,
      adapterId: "stack",
      slots: { content: [{ kind: "slot-outlet", id: `outlet-${uuid}`, slotId: "content" }] },
    },
  };
}

function fillDocumentCatalog(
  target: Awaited<ReturnType<typeof registerTrustedTarget>>,
  count: number,
): void {
  const documents = target.documentRegistration?.documents;
  if (!documents) throw new Error("Expected registered documents");
  for (let index = documents.size; index < count; index += 1) {
    documents.set(`screen.capacity-${index}`, {
      id: `screen.capacity-${index}`,
      origin: "registered",
      sourceFileIds: [],
      writeFileIds: [],
      load: () => makeDocument(`screen.capacity-${index}`, `Capacity ${index}`, "screen"),
      materialize: () => ({}),
    });
  }
}
