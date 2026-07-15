import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const forbiddenHostingFiles = ["vercel.json", ".vercel", "netlify.toml"];
const forbiddenRuntimePattern = /design-space-target|\/__design-space\/api|tailwindcss-language-server|@tailwindcss\/language-server|analyze-tailwind/i;

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
let productionText = "";
for (const file of files) {
  if (!file.isFile()) continue;
  const text = readFileSync(resolve(file.parentPath, file.name), "utf8");
  productionText += text;
  if (forbiddenRuntimePattern.test(text)) {
    throw new Error(`Design Space leaked into target production artifact: ${file.name}`);
  }
}

for (const expected of ["screen.dashboard", "component.panel", "review-panel"]) {
  if (!productionText.includes(expected)) {
    throw new Error(`Target production build did not consume the saved composition: ${expected}`);
  }
}

rmSync(output, { force: true, recursive: true });

const browserOutput = resolve(root, "dist");
if (!existsSync(browserOutput)) {
  throw new Error("Local-only boundary failed: build the Design Space browser bundle before verification.");
}
for (const file of readdirSync(browserOutput, { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const text = readFileSync(resolve(file.parentPath, file.name), "utf8");
  if (/tailwindcss-language-server|@tailwindcss\/language-server/i.test(text)) {
    throw new Error(`Server-only Tailwind tooling leaked into the browser bundle: ${file.name}`);
  }
}

console.log("Local-only boundary verified: target production and browser artifacts exclude the Design Space server runtime and Tailwind language-server executable.");
