#!/usr/bin/env bun
import { spawn, type ChildProcess } from "node:child_process";

import { readProcessTreeRssKb } from "./process-memory-limit";

const DEFAULT_LIMIT_MB = 4096;
const POLL_INTERVAL_MS = 250;
const FORCE_KILL_DELAY_MS = 1500;

function configuredLimitMb(): number {
  const raw = process.env.DESIGN_SPACE_MEMORY_LIMIT_MB;
  if (!raw) return DEFAULT_LIMIT_MB;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 256) {
    throw new Error(
      "DESIGN_SPACE_MEMORY_LIMIT_MB must be a number of at least 256 MB.",
    );
  }
  return parsed;
}

function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    // The command may already have exited between the memory check and signal.
  }
}

const separator = process.argv.indexOf("--");
const commandParts =
  separator >= 0 ? process.argv.slice(separator + 1) : process.argv.slice(2);
const [command, ...args] = commandParts;
if (!command) {
  throw new Error(
    "Usage: bun scripts/run-with-memory-limit.ts -- <command> [...args]",
  );
}

if (process.env.DESIGN_SPACE_ALLOW_UNLIMITED_MEMORY === "1") {
  const child = spawn(command, args, { env: process.env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  const limitMb = configuredLimitMb();
  const limitKb = limitMb * 1024;
  const child = spawn(command, args, {
    detached: process.platform !== "win32",
    env: process.env,
    stdio: "inherit",
  });
  let memoryLimitExceeded = false;
  let checking = false;

  const interval = setInterval(async () => {
    if (!child.pid || checking || child.exitCode !== null) return;
    checking = true;
    try {
      const rssKb = await readProcessTreeRssKb(child.pid);
      if (rssKb <= limitKb || memoryLimitExceeded) return;
      memoryLimitExceeded = true;
      const usedMb = Math.ceil(rssKb / 1024);
      console.error(
        `\nDesign Space memory limit exceeded: ${usedMb} MB used (limit ${limitMb} MB).`,
      );
      console.error("The command tree is being stopped before it fills swap.\n");
      terminateProcessTree(child, "SIGTERM");
      setTimeout(
        () => terminateProcessTree(child, "SIGKILL"),
        FORCE_KILL_DELAY_MS,
      ).unref();
    } catch {
      // A short-lived command can disappear while ps is collecting its rows.
    } finally {
      checking = false;
    }
  }, POLL_INTERVAL_MS);
  interval.unref();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => terminateProcessTree(child, signal));
  }

  child.on("exit", (code, signal) => {
    clearInterval(interval);
    if (memoryLimitExceeded) process.exit(137);
    if (signal) process.exit(signal === "SIGINT" ? 130 : 143);
    process.exit(code ?? 1);
  });
}
