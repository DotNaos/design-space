import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { canonicalJson } from "../shared/canonical-json";
import type { DesignDocument } from "../shared/design-document";
import { collectDocumentTailwind } from "../shared/document-tailwind";
import type { TargetModule } from "../shared/target-module";
import { DocumentService } from "./document-service";
import { compileTailwindPreview } from "./tailwind-preview";
import { registerTrustedTarget, type TrustedTargetConfig } from "./target-registration";

const initialDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.home",
  label: "Home",
  kind: "screen",
  root: {
    instanceId: "home.root",
    adapterId: "stack",
    props: { className: "p-4" },
    slots: { content: [] },
  },
};

const targetModule: TargetModule = {
  project: { id: "tailwind-document", label: "Tailwind document" },
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "default.stack", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [{
    component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
    controls: [{ id: "surface", label: "Surface", kind: "tailwind", prop: "className" }],
    defaultProps: { className: "p-4" },
    render: () => null,
  }],
};

describe("server-owned document Tailwind validation", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "design-space-document-tailwind-"));
    roots.push(root);
    const documentPath = join(root, "home.design.json");
    const themePath = join(root, "theme.css");
    await writeFile(documentPath, `${canonicalJson(initialDocument, 2)}\n`);
    await writeFile(themePath, ".surface{background:#123456}\n");
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    const config: TrustedTargetConfig = {
      project: targetModule.project,
      root,
      targetModule: "target.tsx",
      files: { "document.source": "home.design.json", "tailwind.theme": "theme.css" },
      editTargets: {},
      tailwindCompiler: {
        sourceFileIds: ["tailwind.theme"],
        compile: async (classList, context) => {
          const stock = classList.split(" ").filter((token) => token && token !== "surface").join(" ");
          const preview = await compileTailwindPreview(stock);
          return [preview.css, classList.split(" ").includes("surface") ? context.sources["tailwind.theme"] : ""]
            .filter(Boolean)
            .join("\n");
        },
      },
      documentRegistration: {
        version: "tailwind.document.v1",
        tailwindClassList: (document, context) =>
          collectDocumentTailwind(targetModule, context.libraryDocuments, document.root),
        documents: {
          "screen.home": {
            sourceFileIds: ["document.source"],
            writeFileIds: ["document.source"],
            load: (sources) => JSON.parse(sources["document.source"]),
            materialize: (document) => ({ "document.source": `${canonicalJson(document, 2)}\n` }),
            strictUi: () => [],
            compile: (sources) => JSON.parse(sources["document.source"]),
          },
        },
      },
    };
    return {
      documentPath,
      themePath,
      service: new DocumentService(await registerTrustedTarget(config)),
    };
  }

  it("blocks an invalid document class even when the caller bypasses the browser", async () => {
    const { documentPath, service } = await fixture();
    const snapshot = await service.read("screen.home");
    const proposed = structuredClone(snapshot.document);
    proposed.root.props = { className: "not-a-real-design-space-utility" };

    await expect(service.prepare(
      snapshot.documentId,
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    )).resolves.toMatchObject({
      state: "compile-blocked",
      compile: { status: "failed", message: "The target rejected this document's Tailwind classes" },
    });
    expect(await readFile(documentPath, "utf8")).toContain('"className": "p-4"');
  });

  it("accepts target-owned utilities and invalidates the save when the theme changes", async () => {
    const { service, themePath } = await fixture();
    const snapshot = await service.read("screen.home");
    const proposed = structuredClone(snapshot.document);
    proposed.root.props = { className: "surface p-6" };
    const prepared = await service.prepare(
      snapshot.documentId,
      proposed,
      snapshot.documentDigest,
      snapshot.sourceVersions,
    );
    expect(prepared).toMatchObject({ state: "ready", compile: { status: "passed" } });
    if (prepared.state !== "ready") throw new Error("Expected a ready save");

    await writeFile(themePath, ".surface{background:#654321}\n");
    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
  });
});
