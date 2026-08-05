import { relative } from "node:path";

import { normalizePath, transformWithEsbuild, type Plugin } from "vite";

import { registeredFileCatalog } from "./document-catalog-files";
import { annotateSourceHtmlLayers } from "./source-layer-annotation";
import {
  parseSourceDraftPreviewModuleId,
  sourceDraftPreviewModuleId,
  type SourceDraftPreviewRegistry,
} from "./source-draft-preview-registry";
import type { RegisteredTarget } from "./target-registration";
import { validateTargetModule } from "./target-registration";

export const DESIGN_SPACE_TARGET_MODULE_ID = "virtual:design-space-target";
const resolvedModuleId = `\0${DESIGN_SPACE_TARGET_MODULE_ID}`;
const registeredTargetModuleId = `${DESIGN_SPACE_TARGET_MODULE_ID}/registered`;

export function designSpaceTargetPlugin(target: RegisteredTarget, draftPreviews?: SourceDraftPreviewRegistry): Plugin {
  const sourceWorkspace = target.sourceWorkspace;
  const developmentLibrary = target.sourceLibrary?.development;
  const indexedWorkspaces = [sourceWorkspace, developmentLibrary].filter((workspace) => workspace !== undefined);
  const sourceLayerPaths = new Map(indexedWorkspaces.flatMap((workspace) => workspace.files)
    .filter((file) => file.relativePath.endsWith(".tsx"))
    .map((file) => [normalizePath(file.absolutePath), file.relativePath]));
  return {
    name: "design-space-target",
    enforce: "pre",
    buildStart() {
      if (target.registrationPath) this.addWatchFile(target.registrationPath);
      if (sourceWorkspace) {
        for (const file of sourceWorkspace.files) this.addWatchFile(file.absolutePath);
      }
      if (developmentLibrary) {
        for (const file of developmentLibrary.files) this.addWatchFile(file.absolutePath);
      }
    },
    async resolveId(id, importer) {
      const requestedPreview = parseSourceDraftPreviewModuleId(id);
      const requestedFile = requestedPreview
        ? draftPreviews?.metadata(requestedPreview.challengeId, requestedPreview.fileId)
        : undefined;
      if (requestedPreview && requestedFile) {
        return `\0${sourceDraftPreviewModuleId(
          requestedPreview.challengeId,
          requestedPreview.fileId,
          requestedFile.relativePath,
        )}${requestSuffix(id)}`;
      }
      const previewImporter = importer ? parseSourceDraftPreviewModuleId(importer) : undefined;
      if (previewImporter && draftPreviews) {
        const originalImporter = draftPreviews.originalImporter(previewImporter.challengeId, previewImporter.fileId);
        if (!originalImporter) return undefined;
        const resolved = await this.resolve(id, originalImporter, { skipSelf: true });
        if (!resolved) return undefined;
        const previewFile = draftPreviews.fileForPath(previewImporter.challengeId, resolved.id);
        return previewFile
          ? `\0${sourceDraftPreviewModuleId(
            previewImporter.challengeId,
            previewFile.id,
            previewFile.relativePath,
          )}${requestSuffix(resolved.id)}`
          : resolved;
      }
      if (id === DESIGN_SPACE_TARGET_MODULE_ID) return resolvedModuleId;
      if (!sourceWorkspace && id === registeredTargetModuleId) return target.targetModulePath;
      return undefined;
    },
    async configureServer(server) {
      if (target.registrationPath) {
        server.watcher.add(target.registrationPath);
        server.watcher.on("change", (changedPath) => {
          if (changedPath === target.registrationPath) void server.restart();
        });
      }
      if (sourceWorkspace) {
        const appRoot = normalizePath(`${target.root}/${sourceWorkspace.manifest.sourceRoot}/`);
        server.watcher.add([appRoot, ...sourceWorkspace.files.map((file) => file.absolutePath)]);
        const restartForSourceShape = (changedPath: string) => {
          const normalized = normalizePath(changedPath);
          if (normalized.startsWith(appRoot) && /\.[cm]?[jt]sx?$/.test(normalized)) void server.restart();
        };
        server.watcher.on("add", restartForSourceShape);
        server.watcher.on("unlink", restartForSourceShape);
        server.watcher.on("change", restartForSourceShape);
      }
      if (developmentLibrary) {
        const libraryRoot = normalizePath(`${developmentLibrary.root}/${developmentLibrary.manifest.sourceRoot}/`);
        server.watcher.add([libraryRoot, ...developmentLibrary.files.map((file) => file.absolutePath)]);
        const restartForLibraryShape = (changedPath: string) => {
          const normalized = normalizePath(changedPath);
          if (normalized.startsWith(libraryRoot) && /\.[cm]?[jt]sx?$/.test(normalized)) void server.restart();
        };
        server.watcher.on("add", restartForLibraryShape);
        server.watcher.on("unlink", restartForLibraryShape);
        server.watcher.on("change", restartForLibraryShape);
      }
      if (sourceWorkspace) return;
      const loaded = await server.ssrLoadModule(target.targetModulePath);
      validateTargetModule(loaded.target);
    },
    async load(id) {
      const preview = parseSourceDraftPreviewModuleId(id);
      if (preview && draftPreviews) return (await draftPreviews.load(preview.challengeId, preview.fileId))?.source;
      if (id !== resolvedModuleId) return undefined;
      if (sourceWorkspace) return sourceTargetModule(target);
      return [
        `import { target as registeredTarget } from ${JSON.stringify(registeredTargetModuleId)};`,
        "export const target = registeredTarget;",
        "export default registeredTarget;",
      ].join("\n");
    },
    async transform(code, id) {
      const preview = parseSourceDraftPreviewModuleId(id);
      const previewPath = preview && draftPreviews
        ? draftPreviews.metadata(preview.challengeId, preview.fileId)?.relativePath
        : undefined;
      if (previewPath) {
        const loader = previewScriptLoader(previewPath);
        if (!loader) return undefined;
        const source = previewPath.endsWith(".tsx")
          ? annotateSourceHtmlLayers(code, previewPath)
          : code;
        return transformWithEsbuild(source, previewPath, { loader, jsx: "automatic" });
      }
      const relativePath = sourceLayerPaths.get(normalizePath(id.split("?", 1)[0] ?? id));
      if (!relativePath) return undefined;
      return { code: annotateSourceHtmlLayers(code, relativePath), map: null };
    },
  };
}

function requestSuffix(id: string): string {
  const query = id.indexOf("?");
  const fragment = id.indexOf("#");
  const start = query < 0 ? fragment : fragment < 0 ? query : Math.min(query, fragment);
  return start < 0 ? "" : id.slice(start);
}

function previewScriptLoader(relativePath: string): "js" | "jsx" | "ts" | "tsx" | undefined {
  const extension = relativePath.split(/[?#]/, 1)[0]?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension === "js" || extension === "jsx" || extension === "ts" || extension === "tsx") return extension;
  return undefined;
}

function sourceTargetModule(target: RegisteredTarget): string {
  const workspace = target.sourceWorkspace;
  if (!workspace) throw new Error("Missing source workspace");
  const web = workspace.manifest.runtime === "react";
  const sourceRuntime = runtimeWorkspaceModule(workspace, "Source", web);
  const developmentRuntime = target.sourceLibrary?.development
    ? runtimeWorkspaceModule(target.sourceLibrary.development, "LibraryDevelopment", true)
    : undefined;
  const release = target.sourceLibrary?.release;
  const releaseImport = release?.modulePath
    ? `import { componentDesigns as ReleaseComponentDesigns, componentDesignStyles as ReleaseComponentDesignStyles } from ${JSON.stringify(normalizePath(release.modulePath))};`
    : undefined;
  const files = registeredFileCatalog(target);
  const sourceRootLabel = relative(target.root, `${target.root}/${workspace.manifest.sourceRoot}`) || workspace.manifest.sourceRoot;
  return [
    ...sourceRuntime.imports,
    ...(developmentRuntime?.imports ?? []),
    ...(releaseImport ? [releaseImport] : []),
    "const NativePreviewUnavailable = () => null;",
    "const sourceHostAdapter = {",
    `  component: { id: "source-workspace-host", label: "Source workspace", group: "Project", description: ${JSON.stringify(`Direct renderer for ${sourceRootLabel}`)}, slots: [] },`,
    "  render: () => null,",
    "};",
    "export const target = {",
    `  project: ${JSON.stringify(target.project)},`,
    "  adapters: [sourceHostAdapter],",
    "  defaultAdapterId: sourceHostAdapter.component.id,",
    "  defaultFixture: { instanceId: \"source-workspace-root\", adapterId: sourceHostAdapter.component.id, slots: {} },",
    `  files: ${JSON.stringify(files)},`,
    "  sourceWorkspace: {",
    `    runtime: ${JSON.stringify(workspace.manifest.runtime)},`,
    `    sourceRoot: ${JSON.stringify(workspace.manifest.sourceRoot)},`,
    `    devices: ${JSON.stringify(workspace.manifest.devices)},`,
    `    library: ${JSON.stringify(workspace.manifest.library)},`,
    `    approvals: ${JSON.stringify(workspace.manifest.approvals)},`,
    `    capabilities: ${JSON.stringify({ createComponents: Boolean(target.sourceComponentStore) })},`,
    `    files: ${JSON.stringify(registeredFileCatalog(target))},`,
    `    entries: [${sourceRuntime.entries.join(",\n")}],`,
    `    styles: [${sourceRuntime.styles.join(", ")}],`,
    "  },",
    ...(target.sourceLibrary ? [
      "  sourceLibrary: {",
      `    packageName: ${JSON.stringify(target.sourceLibrary.packageName)},`,
      ...(developmentRuntime ? [
        "    development: {",
        `      runtime: ${JSON.stringify(target.sourceLibrary.development?.manifest.runtime)},`,
        `      sourceRoot: ${JSON.stringify(target.sourceLibrary.development?.manifest.sourceRoot)},`,
        `      devices: ${JSON.stringify(target.sourceLibrary.development?.manifest.devices)},`,
        `      approvals: ${JSON.stringify(target.sourceLibrary.development?.manifest.approvals)},`,
        "      capabilities: { createComponents: false },",
        `      entries: [${developmentRuntime.entries.join(",\n")}],`,
        `      styles: [${developmentRuntime.styles.join(", ")}],`,
        "    },",
      ] : []),
      ...(release ? [
        "    release: {",
        `      version: ${JSON.stringify(release.version)},`,
        `      entries: ${releaseImport ? "ReleaseComponentDesigns.map((item) => packagedLibraryEntry(item))" : "[]"},`,
        `      styles: ${releaseImport ? "ReleaseComponentDesignStyles ?? []" : "[]"},`,
        "    },",
      ] : []),
      "  },",
    ] : []),
    "};",
    "function packagedLibraryEntry(item) {",
    "  const id = `library.release.${item.name}`;",
    "  return { id, label: item.name, area: 'components', device: 'desktop', fileId: id, relativePath: item.source ?? `${item.name}.tsx`, exportName: item.name, props: [], slots: [], findings: [], source: { start: 0, end: 0 }, previewable: true, component: NativePreviewUnavailable, design: { fileId: `${id}.design`, relativePath: item.designSource ?? `${item.name}.design.tsx`, load: async () => item.definition } };",
    "}",
    "export default target;",
  ].join("\n");
}

function runtimeWorkspaceModule(
  workspace: NonNullable<RegisteredTarget["sourceWorkspace"]>,
  prefix: string,
  web: boolean,
) {
  const entries = workspace.manifest.entries.map((entry) => {
    const absolutePath = workspace.entryFiles.get(entry.id);
    if (!absolutePath) throw new Error(`Missing source module for ${entry.id}`);
    const designPath = entry.design
      ? workspace.files.find((file) => file.id === entry.design?.fileId)?.absolutePath
      : undefined;
    const design = web && entry.design && designPath
      ? `{ ...${JSON.stringify(entry.design)}, load: () => import(${JSON.stringify(normalizePath(designPath))}).then((module) => module.default) }`
      : "undefined";
    return `{ ...${JSON.stringify(entry)}, component: NativePreviewUnavailable, design: ${design} }`;
  });
  const styleImports = web ? workspace.stylePaths.map((path, index) => ({
    statement: `import ${prefix}Style${index} from ${JSON.stringify(`${normalizePath(path)}?inline`)};`,
    variable: `${prefix}Style${index}`,
  })) : [];
  return {
    entries,
    imports: styleImports.map((style) => style.statement),
    styles: styleImports.map((style) => style.variable),
  };
}
