import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateStrictUi } from "../model/strict-ui";
import { canonicalJson } from "../shared/canonical-json";
import type { DesignChild, DesignDocument } from "../shared/design-document";
import type { TargetModule } from "../shared/target-module";
import { DocumentService } from "./document-service";
import { registerTrustedTarget, type TrustedDocumentTarget, type TrustedTargetConfig } from "./target-registration";

const firstUuid = "11111111-1111-4111-8111-111111111111";

describe("server-owned authored component validation", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  it("saves a registered screen that uses an authored component", async () => {
    const fixture = await createFixture();
    const snapshot = await fixture.service.read("screen.home");
    const prepared = await fixture.service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Updated home" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );

    expect(prepared).toMatchObject({ state: "ready", strictUi: { status: "passed" } });
    if (prepared.state !== "ready") throw new Error("Expected a ready save");
    await expect(fixture.service.save(prepared.challengeId)).resolves.toMatchObject({ state: "saved" });
    expect(JSON.parse(await readFile(fixture.paths.screen, "utf8"))).toMatchObject({ label: "Updated home" });
  });

  it("rejects an indirect cycle across authored component documents", async () => {
    const fixture = await createFixture();
    const snapshot = await fixture.service.read("component.alpha");
    const cycle = componentDocument("component.alpha", "Alpha", "authored.alpha", "authored.beta");
    const prepared = await fixture.service.prepare(
      "component.alpha",
      cycle,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );

    expect(prepared).toMatchObject({ state: "strict-blocked", strictUi: { status: "blocked" } });
    expect(prepared.strictUi.violations.some((violation) => violation.ruleId === "component.cycle")).toBe(true);
    expect(JSON.parse(await readFile(fixture.paths.alpha, "utf8"))).toMatchObject({ label: "Alpha" });
  });

  it("blocks a component contract change that breaks a dependent screen", async () => {
    const fixture = await createFixture();
    const snapshot = await fixture.service.read("component.panel");
    const proposed = structuredClone(snapshot.document);
    if (!proposed.component) throw new Error("Expected a component document");
    proposed.component.slots = [];
    proposed.root!.slots.content = [];

    const prepared = await fixture.service.prepare(
      "component.panel",
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );

    expect(prepared).toMatchObject({ state: "strict-blocked", strictUi: { status: "blocked" } });
    if (prepared.state !== "strict-blocked") throw new Error("Expected a blocked save");
    expect(prepared.strictUi.violations).toContainEqual(expect.objectContaining({
      ruleId: "slot.undeclared",
      message: expect.stringContaining("Dependent Home"),
      location: { kind: "document" },
    }));
  });

  it("blocks removing a public property used by a dependent screen", async () => {
    const fixture = await createFixture();
    const snapshot = await fixture.service.read("component.panel");
    const proposed = structuredClone(snapshot.document);
    if (!proposed.component) throw new Error("Expected a component document");
    proposed.component.properties = [];
    delete proposed.root!.propertyBindings;

    const prepared = await fixture.service.prepare(
      "component.panel",
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );

    expect(prepared).toMatchObject({ state: "strict-blocked", strictUi: { status: "blocked" } });
    if (prepared.state !== "strict-blocked") throw new Error("Expected a blocked save");
    expect(prepared.strictUi.violations).toContainEqual(expect.objectContaining({
      ruleId: "property.undeclared",
      message: expect.stringContaining("Dependent Home"),
      location: { kind: "document" },
    }));
  });

  it("allows a compatible component contract change", async () => {
    const fixture = await createFixture();
    const snapshot = await fixture.service.read("component.panel");
    const proposed = structuredClone(snapshot.document);
    if (!proposed.component) throw new Error("Expected a component document");
    proposed.component.description = "A compatible contract description.";

    await expect(fixture.service.prepare(
      "component.panel",
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).resolves.toMatchObject({ state: "ready", strictUi: { status: "passed" } });
  });

  it("invalidates a component save when a dependent screen changes", async () => {
    const fixture = await createFixture();
    const snapshot = await fixture.service.read("component.panel");
    const proposed = structuredClone(snapshot.document);
    if (!proposed.component) throw new Error("Expected a component document");
    proposed.component.description = "Prepared against the current consumers.";
    const prepared = await fixture.service.prepare(
      "component.panel",
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    if (prepared.state !== "ready") throw new Error("Expected a ready save");
    const screen = JSON.parse(await readFile(fixture.paths.screen, "utf8")) as DesignDocument;
    await writeDocument(fixture.paths.screen, { ...screen, label: "Concurrent screen edit" });

    await expect(fixture.service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    const unchanged = await fixture.service.read("component.panel");
    expect(unchanged.document.component?.description).toBeUndefined();
  });

  it("invalidates a registered save when an authored dependency changes", async () => {
    const fixture = await createFixture();
    const originalScreen = await readFile(fixture.paths.screen, "utf8");
    const snapshot = await fixture.service.read("screen.home");
    const prepared = await fixture.service.prepare(
      "screen.home",
      { ...snapshot.document, label: "Must stay pending" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    if (prepared.state !== "ready") throw new Error("Expected a ready save");
    const panel = JSON.parse(await readFile(fixture.paths.panel, "utf8")) as DesignDocument;
    await writeDocument(fixture.paths.panel, { ...panel, label: "Concurrent panel edit" });

    await expect(fixture.service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(await readFile(fixture.paths.screen, "utf8")).toBe(originalScreen);
  });

  it("validates and saves a managed screen against the authored library", async () => {
    const fixture = await createFixture({ createManagedDocumentId: () => firstUuid });
    const prepared = await fixture.service.prepareCreate("panel-screen", "Managed panel screen");

    expect(prepared).toMatchObject({ state: "create-ready", strictUi: { status: "passed" } });
    if (prepared.state !== "create-ready") throw new Error("Expected a ready managed creation");
    expect(Object.keys(prepared.nextSourceVersions)).toEqual([`managed.${firstUuid}`]);
    await expect(fixture.service.save(prepared.challengeId)).resolves.toMatchObject({ state: "saved" });
    const snapshot = await fixture.service.read(`screen.${firstUuid}`);
    const edited = await fixture.service.prepare(
      snapshot.documentId,
      { ...snapshot.document, label: "Edited managed panel screen" },
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    expect(edited).toMatchObject({ state: "ready", strictUi: { status: "passed" } });
    if (edited.state !== "ready") throw new Error("Expected a ready managed edit");
    await fixture.service.save(edited.challengeId);
    await expect(fixture.service.read(`screen.${firstUuid}`)).resolves.toMatchObject({
      document: { label: "Edited managed panel screen" },
    });
  });

  it("invalidates a managed creation when an authored dependency changes", async () => {
    const fixture = await createFixture({ createManagedDocumentId: () => firstUuid });
    const prepared = await fixture.service.prepareCreate("panel-screen", "Stale managed screen");
    if (prepared.state !== "create-ready") throw new Error("Expected a ready managed creation");
    const panel = JSON.parse(await readFile(fixture.paths.panel, "utf8")) as DesignDocument;
    await writeDocument(fixture.paths.panel, { ...panel, label: "Concurrent panel edit" });

    await expect(fixture.service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    await expect(readFile(join(fixture.root, "managed", `${firstUuid}.design.json`), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  async function createFixture(options: { createManagedDocumentId?: () => string } = {}) {
    const root = await mkdtemp(join(tmpdir(), "design-space-authored-strict-"));
    roots.push(root);
    const paths = {
      screen: join(root, "screen.design.json"),
      panel: join(root, "panel.design.json"),
      alpha: join(root, "alpha.design.json"),
      beta: join(root, "beta.design.json"),
    };
    await mkdir(join(root, "managed"));
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeDocument(paths.screen, screenDocument("screen.home", "Home"));
    await writeDocument(paths.panel, componentDocument("component.panel", "Panel", "authored.panel"));
    await writeDocument(paths.alpha, componentDocument("component.alpha", "Alpha", "authored.alpha"));
    await writeDocument(paths.beta, componentDocument("component.beta", "Beta", "authored.beta", "authored.alpha"));
    const config: TrustedTargetConfig = {
      project: { id: "authored-strict", label: "Authored Strict UI" },
      root,
      targetModule: "target.tsx",
      files: {
        "screen.source": "screen.design.json",
        "panel.source": "panel.design.json",
        "alpha.source": "alpha.design.json",
        "beta.source": "beta.design.json",
      },
      editTargets: {},
      documentRegistration: {
        version: "authored.strict.v1",
        tailwindClassList: () => "",
        documents: {
          "screen.home": jsonTarget("screen.source"),
          "component.panel": jsonTarget("panel.source"),
          "component.alpha": jsonTarget("alpha.source"),
          "component.beta": jsonTarget("beta.source"),
        },
        managed: {
          directory: "managed",
          recipes: {
            "panel-screen": {
              label: "Panel screen",
              kind: "screen",
              create: ({ documentId, label }) => screenDocument(documentId, label),
            },
          },
          strictUi: (document, context) => validateStrictUi(target, document, context.libraryDocuments),
        },
      },
    };
    const registered = await registerTrustedTarget(config);
    return { root, paths, service: new DocumentService(registered, options) };
  }
});

function jsonTarget(fileId: string): TrustedDocumentTarget {
  return {
    sourceFileIds: [fileId],
    writeFileIds: [fileId],
    load: (sources) => JSON.parse(sources[fileId]),
    materialize: (document) => ({ [fileId]: `${canonicalJson(document, 2)}\n` }),
    strictUi: (document, context) => validateStrictUi(target, document, context.libraryDocuments),
  };
}

function screenDocument(id: string, label: string): DesignDocument {
  return {
    schemaVersion: 2,
    id,
    label,
    kind: "screen",
    root: {
      instanceId: `${id}.root`,
      adapterId: "stack",
      slots: {
        content: [{
          kind: "component",
          node: {
            instanceId: `${id}.panel`,
            adapterId: "authored.panel",
            props: { title: "Welcome" },
            slots: { content: [] },
          },
        }],
      },
    },
  };
}

function componentDocument(id: string, label: string, componentId: string, nestedAdapterId?: string): DesignDocument {
  const isPanel = componentId === "authored.panel";
  const children: DesignChild[] = [];
  if (nestedAdapterId) {
    children.push({ kind: "component", node: { instanceId: `${id}.nested`, adapterId: nestedAdapterId, slots: { content: [] } } });
  }
  children.push({ kind: "slot-outlet", id: `${id}.outlet`, slotId: "content" });
  return {
    schemaVersion: 2,
    id,
    label,
    kind: "component",
    component: {
      id: componentId,
      label,
      group: "Custom",
      properties: isPanel
        ? [{ id: "title", label: "Title", prop: "title", kind: "text" }]
        : [],
      slots: [{ id: "content", label: "Content", accepts: ["authored.panel", "authored.alpha", "authored.beta"], acceptsText: false }],
    },
    root: {
      instanceId: `${id}.root`,
      adapterId: "stack",
      ...(isPanel ? { propertyBindings: { title: "title" } } : {}),
      slots: { content: children },
    },
  };
}

async function writeDocument(path: string, document: DesignDocument): Promise<void> {
  await writeFile(path, `${canonicalJson(document, 2)}\n`);
}

const target: TargetModule = {
  project: { id: "authored-strict", label: "Authored Strict UI" },
  adapters: [{
    component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content", accepts: ["authored.panel", "authored.alpha", "authored.beta"], acceptsText: false }] },
    controls: [{ id: "title", label: "Title", kind: "text", prop: "title" }],
    render: () => null,
  }],
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "fixture.root", adapterId: "stack", slots: { content: [] } },
  files: [],
};
