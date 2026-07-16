#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dir, "..");
const projectRoot = process.cwd();
const arguments_ = process.argv.slice(2);

if (arguments_.includes("--help")) {
  console.log("Run Design Space for the current frontend project. Use .designspace.ts; legacy design-space.server.ts targets remain supported.");
  process.exit(0);
}
if (arguments_.length > 0) {
  throw new Error("Design Space accepts no project paths or commands. Run it from the registered target project.");
}
if (
  !existsSync(resolve(projectRoot, ".designspace.ts")) &&
  !existsSync(resolve(projectRoot, "design-space.server.ts"))
) {
  throw new Error("The current frontend project has no .designspace.ts config.");
}

const child = spawn("bun", [resolve(packageRoot, "scripts/dev.ts")], {
  cwd: packageRoot,
  env: { ...process.env, DESIGN_SPACE_PROJECT_ROOT: projectRoot },
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
