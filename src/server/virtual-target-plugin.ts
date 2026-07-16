import { relative } from "node:path";

import { normalizePath, type Plugin } from "vite";

import { registeredFileCatalog } from "./document-catalog-files";
import type { RegisteredTarget } from "./target-registration";
import { validateTargetModule } from "./target-registration";

export const DESIGN_SPACE_TARGET_MODULE_ID = "virtual:design-space-target";
const resolvedModuleId = `\0${DESIGN_SPACE_TARGET_MODULE_ID}`;
const registeredTargetModuleId = `${DESIGN_SPACE_TARGET_MODULE_ID}/registered`;

export function designSpaceTargetPlugin(target: RegisteredTarget): Plugin {
  const sourceWorkspace = target.sourceWorkspace;
  return {
    name: "design-space-target",
    enforce: "pre",
    buildStart() {
      if (target.registrationPath) this.addWatchFile(target.registrationPath);
      if (sourceWorkspace) {
        for (const file of sourceWorkspace.files) this.addWatchFile(file.absolutePath);
      }
    },
    resolveId(id) {
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
        server.watcher.add(sourceWorkspace.files.map((file) => file.absolutePath));
        const restartForSourceShape = (changedPath: string) => {
          const normalized = normalizePath(changedPath);
          if (normalized.startsWith(appRoot) && /\.[cm]?[jt]sx?$/.test(normalized)) void server.restart();
        };
        server.watcher.on("add", restartForSourceShape);
        server.watcher.on("unlink", restartForSourceShape);
        server.watcher.on("change", restartForSourceShape);
        return;
      }
      const loaded = await server.ssrLoadModule(target.targetModulePath);
      validateTargetModule(loaded.target);
    },
    load(id) {
      if (id !== resolvedModuleId) return undefined;
      if (sourceWorkspace) return sourceTargetModule(target);
      return [
        `import { target as registeredTarget } from ${JSON.stringify(registeredTargetModuleId)};`,
        "export const target = registeredTarget;",
        "export default registeredTarget;",
      ].join("\n");
    },
  };
}

function sourceTargetModule(target: RegisteredTarget): string {
  const workspace = target.sourceWorkspace;
  if (!workspace) throw new Error("Missing source workspace");
  const web = workspace.manifest.runtime === "react";
  const runtimeEntries = workspace.manifest.entries.map((entry) => {
    const absolutePath = workspace.entryFiles.get(entry.id);
    if (!absolutePath) throw new Error(`Missing source module for ${entry.id}`);
    const modulePath = JSON.stringify(normalizePath(absolutePath));
    const exportName = JSON.stringify(entry.exportName);
    const component = web && entry.previewable !== false
      ? `lazy(() => import(${modulePath}).then((module) => ({ default: module[${exportName}] })))`
      : "NativePreviewUnavailable";
    return `{ ...${JSON.stringify(entry)}, component: ${component} }`;
  });
  const styleImports = web ? workspace.stylePaths.map((path, index) => ({
    statement: `import SourceStyle${index} from ${JSON.stringify(`${normalizePath(path)}?inline`)};`,
    variable: `SourceStyle${index}`,
  })) : [];
  const files = registeredFileCatalog(target);
  const sourceRootLabel = relative(target.root, `${target.root}/${workspace.manifest.sourceRoot}`) || workspace.manifest.sourceRoot;
  return [
    'import { lazy } from "react";',
    ...styleImports.map((style) => style.statement),
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
    `    entries: [${runtimeEntries.join(",\n")}],`,
    `    styles: [${styleImports.map((style) => style.variable).join(", ")}],`,
    "  },",
    "};",
    "export default target;",
  ].join("\n");
}
