import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const isRaw = process.argv.includes("--raw");
const allowDirect = process.env.DESIGN_SPACE_ALLOW_DIRECT === "1";
const portlessName = process.env.DESIGN_SPACE_PORTLESS_NAME ?? "design-space";
const uiLibraryRoot = process.env.DESIGN_SPACE_UI_LIBRARY_ROOT ?? siblingUiLibraryRoot();

function run(command: string, args: string[], env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

if (!isRaw) {
  if (process.env.PORTLESS === "0" && !allowDirect) {
    throw new Error(
      "Design Space must run through Portless. Set DESIGN_SPACE_ALLOW_DIRECT=1 only for exceptional debugging.",
    );
  }

  run("bunx", ["portless", "--name", portlessName, "bun", "./scripts/dev.ts", "--raw"], {
    ...process.env,
    DESIGN_SPACE_VIA_PORTLESS: "1",
    ...(uiLibraryRoot ? { DESIGN_SPACE_UI_LIBRARY_ROOT: uiLibraryRoot } : {}),
  });
} else {
  if (process.env.DESIGN_SPACE_VIA_PORTLESS !== "1" && !allowDirect) {
    throw new Error("Raw Vite startup is blocked. Run `bun run dev` through Portless.");
  }

  if (!process.env.PORT && !allowDirect) {
    throw new Error("Portless did not provide a target port.");
  }

  run("bunx", ["vite", "--host", "127.0.0.1"], process.env);
}

function siblingUiLibraryRoot(): string | undefined {
  try {
    const commonDirectory = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const repository = resolve(commonDirectory, "..", "..", "ui");
    const candidate = resolve(repository, "packages", "react-ui");
    return existsSync(resolve(candidate, "package.json"))
      && existsSync(resolve(candidate, ".designspace.ts"))
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}
