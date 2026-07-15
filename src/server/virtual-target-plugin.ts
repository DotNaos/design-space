import type { Plugin } from "vite";

import type { RegisteredTarget } from "./target-registration";
import { validateTargetModule } from "./target-registration";

export const DESIGN_SPACE_TARGET_MODULE_ID = "virtual:design-space-target";
const resolvedModuleId = `\0${DESIGN_SPACE_TARGET_MODULE_ID}`;
const registeredTargetModuleId = `${DESIGN_SPACE_TARGET_MODULE_ID}/registered`;

export function designSpaceTargetPlugin(target: RegisteredTarget): Plugin {
  return {
    name: "design-space-target",
    enforce: "pre",
    buildStart() {
      if (target.registrationPath) this.addWatchFile(target.registrationPath);
    },
    resolveId(id) {
      if (id === DESIGN_SPACE_TARGET_MODULE_ID) return resolvedModuleId;
      if (id === registeredTargetModuleId) return target.targetModulePath;
      return undefined;
    },
    async configureServer(server) {
      if (target.registrationPath) {
        server.watcher.add(target.registrationPath);
        server.watcher.on("change", (changedPath) => {
          if (changedPath === target.registrationPath) void server.restart();
        });
      }
      const loaded = await server.ssrLoadModule(target.targetModulePath);
      validateTargetModule(loaded.target);
    },
    load(id) {
      if (id !== resolvedModuleId) return undefined;
      return [
        `import { target as registeredTarget } from ${JSON.stringify(registeredTargetModuleId)};`,
        "export const target = registeredTarget;",
        "export default registeredTarget;",
      ].join("\n");
    },
  };
}
