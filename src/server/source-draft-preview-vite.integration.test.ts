import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { createServer as createViteServer } from "vite";
import { expect, it } from "vitest";

import { loadRegisteredProject } from "./project-loader";
import { sourceDraftPreviewModuleUrl } from "./source-draft-preview-registry";
import { sourceVersion } from "./source-editor";

const root = resolve(import.meta.dirname, "../..");

it("serves a server-prepared source and design graph without writing the draft", async () => {
  const previousDirect = process.env.DESIGN_SPACE_ALLOW_DIRECT;
  process.env.DESIGN_SPACE_ALLOW_DIRECT = "1";
  const target = await loadRegisteredProject(resolve(root, "examples/source-target"));
  const entry = target.sourceWorkspace?.manifest.entries.find((candidate) => candidate.design);
  const sourceFile = target.sourceWorkspace?.files.find((file) => file.id === entry?.fileId);
  const designFile = target.sourceWorkspace?.files.find((file) => file.id === entry?.design?.fileId);
  const styleFile = target.sourceWorkspace?.files.find((file) => file.relativePath === "src/styles.css");
  expect(sourceFile).toBeDefined();
  expect(designFile).toBeDefined();
  expect(styleFile).toBeDefined();
  const before = await readFile(sourceFile!.absolutePath, "utf8");
  const beforeDesign = await readFile(designFile!.absolutePath, "utf8");
  const draft = before.replace('"checking"', '"prepared checking"');
  const designDraft = `import "../../../styles.css";\n${beforeDesign.replace('"Project Space"', '"Prepared Project Space"')}`;
  const vite = await createViteServer({
    configFile: resolve(root, "vite.config.ts"),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
  });
  const server = createHttpServer(vite.middlewares);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  try {
    const preparedResponse = await fetch(`${origin}/__design-space/api`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "prepare-source-change-set",
        scope: "app",
        changes: [
          { fileId: sourceFile!.id, baseVersion: sourceVersion(before), source: draft },
          { fileId: designFile!.id, baseVersion: sourceVersion(beforeDesign), source: designDraft },
        ],
      }),
    });
    expect(preparedResponse.status).toBe(200);
    const payload = await preparedResponse.json() as { data: { challengeId: string } };
    const moduleHeaders = { accept: "text/javascript" };
    const sourceResponse = await fetch(`${origin}${sourceDraftPreviewModuleUrl(
      payload.data.challengeId,
      sourceFile!.id,
      sourceFile!.relativePath,
    )}`, { headers: moduleHeaders });
    const designResponse = await fetch(`${origin}${sourceDraftPreviewModuleUrl(
      payload.data.challengeId,
      designFile!.id,
      designFile!.relativePath,
    )}`, { headers: moduleHeaders });
    const styleResponse = await fetch(`${origin}${sourceDraftPreviewModuleUrl(
      payload.data.challengeId,
      styleFile!.id,
      styleFile!.relativePath,
    )}`, { headers: moduleHeaders });

    expect(sourceResponse.status).toBe(200);
    const sourceModule = await sourceResponse.text();
    expect(sourceModule).toContain("prepared checking");
    expect(sourceModule).not.toContain("<section>");
    expect(sourceModule).toMatch(/jsxDEV|jsx-runtime/);
    expect(designResponse.status).toBe(200);
    const designModule = await designResponse.text();
    expect(designModule).toContain("Prepared Project Space");
    expect(designModule).toContain("design-space-source-preview");
    expect(designModule).toContain("module.css");
    expect(styleResponse.status).toBe(200);
    expect(styleResponse.headers.get("content-type")).toContain("javascript");
    const styleModule = await styleResponse.text();
    expect(styleModule).toContain("background");
    expect(styleModule).toMatch(/updateStyle|__vite__css/);
    expect(styleModule.trimStart().startsWith("@import")).toBe(false);
    await expect(readFile(sourceFile!.absolutePath, "utf8")).resolves.toBe(before);
    await expect(readFile(designFile!.absolutePath, "utf8")).resolves.toBe(beforeDesign);
  } finally {
    server.closeAllConnections();
    if (server.listening) {
      await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    }
    await vite.close();
    if (previousDirect === undefined) delete process.env.DESIGN_SPACE_ALLOW_DIRECT;
    else process.env.DESIGN_SPACE_ALLOW_DIRECT = previousDirect;
  }
}, 30_000);
