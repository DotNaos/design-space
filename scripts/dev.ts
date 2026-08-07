import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { startTailnetRoute, type TailnetRoute } from "./tailnet-route";

const root = resolve(import.meta.dir, "..");
const isRaw = process.argv.includes("--raw");
const allowDirect = process.env.DESIGN_SPACE_ALLOW_DIRECT === "1";
const portlessName = process.env.DESIGN_SPACE_PORTLESS_NAME ?? "design-space";
const uiLibraryRoot = process.env.DESIGN_SPACE_UI_LIBRARY_ROOT ?? siblingUiLibraryRoot();
const tailnetEnabled = process.env.DESIGN_SPACE_TAILNET !== "0";

function run(
  command: string,
  args: string[],
  env = process.env,
  tailnetRoute?: TailnetRoute,
) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  let finishing: Promise<void> | undefined;
  let requestedSignal: NodeJS.Signals | undefined;
  const finish = (code: number, signal?: NodeJS.Signals) => {
    if (finishing) return finishing;
    finishing = (async () => {
      try {
        await tailnetRoute?.stop();
      } catch (error) {
        console.error("Could not remove the Tailnet development route:", error);
      } finally {
        if (signal) {
          for (const forwardedSignal of forwardedSignals) {
            process.removeAllListeners(forwardedSignal);
          }
          process.kill(process.pid, signal);
        } else {
          process.exit(code);
        }
      }
    })();
    return finishing;
  };
  for (const signal of forwardedSignals) {
    process.on(signal, () => {
      if (requestedSignal) return;
      requestedSignal = signal;
      child.kill(signal);
    });
  }
  child.on("error", (error) => {
    console.error(error);
    void finish(1);
  });
  child.on("exit", (code, signal) => {
    const exitSignal = requestedSignal ?? signal ?? undefined;
    void finish(code ?? (exitSignal ? 1 : 0), exitSignal);
  });
}

if (!isRaw) {
  if (process.env.PORTLESS === "0" && !allowDirect) {
    throw new Error(
      "Design Space must run through Portless. Set DESIGN_SPACE_ALLOW_DIRECT=1 only for exceptional debugging.",
    );
  }

  let tailnetRoute: TailnetRoute | undefined;
  const portlessArgs = ["portless", "--name", portlessName];
  if (tailnetEnabled) {
    tailnetRoute = await startTailnetRoute(`${root}\0${portlessName}`);
    portlessArgs.push("--app-port", String(tailnetRoute.localPort));
    console.log(`Tailscale: ${tailnetRoute.publicUrl}`);
  } else {
    console.log("Tailnet preview disabled by DESIGN_SPACE_TAILNET=0.");
  }
  portlessArgs.push("bun", "./scripts/dev.ts", "--raw");
  run("bunx", portlessArgs, {
    ...process.env,
    DESIGN_SPACE_VIA_PORTLESS: "1",
    ...(uiLibraryRoot ? { DESIGN_SPACE_UI_LIBRARY_ROOT: uiLibraryRoot } : {}),
  }, tailnetRoute);
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
