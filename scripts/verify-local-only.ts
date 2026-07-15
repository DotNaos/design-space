import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const forbiddenHostingFiles = ["vercel.json", ".vercel", "netlify.toml"];

for (const name of forbiddenHostingFiles) {
  if (existsSync(resolve(root, name))) {
    throw new Error(`Local-only boundary failed: ${name} must not exist.`);
  }
}

const output = resolve(root, "examples/demo-target/dist-production");
rmSync(output, { force: true, recursive: true });

const build = spawnSync(
  "bunx",
  ["vite", "build", "--config", "examples/demo-target/vite.production.config.ts"],
  { cwd: root, encoding: "utf8" },
);

if (build.status !== 0) {
  throw new Error(`Target production build failed:\n${build.stdout}\n${build.stderr}`);
}

const files = readdirSync(output, { recursive: true, withFileTypes: true });
for (const file of files) {
  if (!file.isFile()) continue;
  const text = readFileSync(resolve(file.parentPath, file.name), "utf8");
  if (/design[- ]space|design-space-target|\/api\/design-space/i.test(text)) {
    throw new Error(`Design Space leaked into target production artifact: ${file.name}`);
  }
}

rmSync(output, { force: true, recursive: true });
console.log("Local-only boundary verified: target production output contains no Design Space runtime.");
