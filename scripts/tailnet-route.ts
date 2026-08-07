import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const routeCount = 1_000;
const firstLocalPort = 43_000;
const firstPublicPort = 45_000;

type TailscaleStatus = {
  TCP?: Record<string, { TCPForward?: string }>;
};

export interface TailnetRuntime {
  output(args: string[]): string;
  run(args: string[]): void;
  localPortAvailable(port: number): Promise<boolean>;
  withAllocationLock<T>(operation: () => Promise<T>): Promise<T>;
}

export type TailnetRoute = {
  localPort: number;
  publicPort: number;
  publicUrl: string;
  stop(): Promise<void>;
};

export function parseTailscaleIPv4(output: string): string {
  const addresses = output.split(/\s+/).filter(Boolean);
  if (addresses.length !== 1 || isIP(addresses[0]) !== 4) {
    throw new Error(`tailscale ip -4 returned ${JSON.stringify(output.trim())}, not one IPv4 address.`);
  }
  return addresses[0];
}

export function tcpRoutes(output: string): Map<number, string> {
  const status = JSON.parse(output || "{}") as TailscaleStatus;
  const routes = new Map<number, string>();
  for (const [portText, route] of Object.entries(status.TCP ?? {})) {
    const port = Number(portText);
    if (Number.isInteger(port)) routes.set(port, route.TCPForward ?? "");
  }
  return routes;
}

export async function startTailnetRoute(
  identity: string,
  runtime: TailnetRuntime = systemTailnetRuntime,
): Promise<TailnetRoute> {
  return runtime.withAllocationLock(async () => {
    const address = parseTailscaleIPv4(runtime.output(["ip", "-4"]));
    const startOffset = stableOffset(identity);

    for (let attempt = 0; attempt < routeCount; attempt += 1) {
      const offset = (startOffset + attempt) % routeCount;
      const localPort = firstLocalPort + offset;
      const publicPort = firstPublicPort + offset;
      const routes = tcpRoutes(runtime.output(["serve", "status", "--json"]));
      if (routes.has(publicPort) || !(await runtime.localPortAvailable(localPort))) continue;

      try {
        runtime.run([
          "serve", "--bg", "--yes", `--tcp=${publicPort}`,
          `tcp://127.0.0.1:${localPort}`,
        ]);
      } catch {
        continue;
      }
      const target = `127.0.0.1:${localPort}`;
      let current: Map<number, string>;
      try {
        current = tcpRoutes(runtime.output(["serve", "status", "--json"]));
      } catch (error) {
        try {
          runtime.run(["serve", `--tcp=${publicPort}`, "off"]);
        } catch {
          // Preserve the verification error after best-effort rollback.
        }
        throw error;
      }
      if (current.get(publicPort) !== target) {
        if (!current.has(publicPort)) runtime.run(["serve", `--tcp=${publicPort}`, "off"]);
        continue;
      }

      return {
        localPort,
        publicPort,
        publicUrl: `http://${address}:${publicPort}`,
        stop: async () => {
          const latest = tcpRoutes(runtime.output(["serve", "status", "--json"]));
          if (latest.get(publicPort) === target) {
            runtime.run(["serve", `--tcp=${publicPort}`, "off"]);
          }
        },
      };
    }
    throw new Error("No free Tailnet development-server port is available.");
  });
}

const systemTailnetRuntime: TailnetRuntime = {
  output(args) {
    return execFileSync("tailscale", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  },
  run(args) {
    execFileSync("tailscale", args, { stdio: ["ignore", "ignore", "pipe"] });
  },
  localPortAvailable(port) {
    return new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
        server.close(() => resolve(true));
      });
    });
  },
  withAllocationLock,
};

async function withAllocationLock<T>(operation: () => Promise<T>): Promise<T> {
  const user = process.getuid?.() ?? "user";
  const lock = join(tmpdir(), `dotnaos-tailnet-dev-${user}.lock`);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      mkdirSync(lock, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      clearStaleLock(lock);
      await new Promise((resolve) => setTimeout(resolve, 25));
      continue;
    }

    try {
      writeFileSync(join(lock, "owner"), String(process.pid), { mode: 0o600 });
      return await operation();
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }
  throw new Error("Timed out while reserving a Tailnet development-server port.");
}

function clearStaleLock(lock: string): void {
  try {
    const owner = Number(readFileSync(join(lock, "owner"), "utf8"));
    if (Number.isInteger(owner) && owner > 0) {
      try {
        process.kill(owner, 0);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") return;
      }
    } else if (Date.now() - statSync(lock).mtimeMs < 5_000) {
      return;
    }
    rmSync(lock, { recursive: true, force: true });
  } catch {
    try {
      if (Date.now() - statSync(lock).mtimeMs >= 5_000) {
        rmSync(lock, { recursive: true, force: true });
      }
    } catch {
      // A concurrent owner may have released the lock between checks.
    }
  }
}

function stableOffset(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % routeCount;
}
