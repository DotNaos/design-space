#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { initializeDesignSpaceProject } from "../src/server/project-initializer";
import { targetRouteName } from "./target-route-name";

const packageRoot = resolve(import.meta.dir, "..");
const projectRoot = process.cwd();
const arguments_ = process.argv.slice(2);

if (arguments_.includes("--help")) {
  console.log("Run Design Space for the current app project. Neutral app.manifest.json projects work directly; legacy projects can use `design-space init` to create .designspace.ts.");
  process.exit(0);
}
if (arguments_.length === 1 && arguments_[0] === "init") {
  const result = await initializeDesignSpaceProject(projectRoot);
  console.log(result.configCreated
    ? `Created ${result.configPath}`
    : `Kept existing ${result.configPath}`);
  console.log(result.packageScriptUpdated
    ? "Added the design-space package script."
    : "The design-space package script is already configured.");
  console.log("Run `pnpm design-space` to open the project.");
  process.exit(0);
}
if (arguments_.length > 0) {
  throw new Error("Unknown command. Run `design-space init` from a frontend project root, or run `design-space` to start.");
}
if (
  !existsSync(resolve(projectRoot, ".designspace.ts")) &&
  !existsSync(resolve(projectRoot, "app.manifest.json")) &&
  !existsSync(resolve(projectRoot, "design-space.server.ts"))
) {
  throw new Error("The current project has no app.manifest.json, .designspace.ts, or server registration.");
}

const { loadRegisteredProject } = await import("../src/server/project-loader");
const registeredProject = await loadRegisteredProject(projectRoot);

const child = spawn("bun", [resolve(packageRoot, "scripts/dev.ts")], {
  cwd: packageRoot,
  env: {
    ...process.env,
    DESIGN_SPACE_PROJECT_ROOT: projectRoot,
    DESIGN_SPACE_PORTLESS_NAME: targetRouteName(registeredProject.project.id),
  },
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
