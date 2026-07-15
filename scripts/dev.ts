import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const isRaw = process.argv.includes("--raw");
const allowDirect = process.env.DESIGN_SPACE_ALLOW_DIRECT === "1";

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

  run("bunx", ["portless", "--name", "design-space", "bun", "./scripts/dev.ts", "--raw"], {
    ...process.env,
    DESIGN_SPACE_VIA_PORTLESS: "1",
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
