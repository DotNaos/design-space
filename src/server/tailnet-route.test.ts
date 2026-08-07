import { describe, expect, it } from "vitest";

import {
  parseTailscaleIPv4,
  startTailnetRoute,
  tcpRoutes,
  type TailnetRuntime,
} from "../../scripts/tailnet-route";

describe("Tailnet development routes", () => {
  it("requires one numeric Tailscale IPv4 address", () => {
    expect(parseTailscaleIPv4("100.80.135.9\n")).toBe("100.80.135.9");
    expect(() => parseTailscaleIPv4("os-macbook.tail.example\n")).toThrow(/not one IPv4/);
    expect(() => parseTailscaleIPv4("100.80.135.9\n100.80.135.10\n")).toThrow(/not one IPv4/);
  });

  it("reads only TCP forwarding routes", () => {
    const routes = tcpRoutes(JSON.stringify({
      TCP: {
        443: { HTTPS: true },
        44012: { TCPForward: "127.0.0.1:43012" },
      },
    }));
    expect([...routes]).toEqual([
      [443, ""],
      [44012, "127.0.0.1:43012"],
    ]);
  });

  it("skips a deterministically occupied local port", async () => {
    const runtime = new FakeTailnetRuntime();
    const first = await startTailnetRoute("nested-worktree", runtime);
    await first.stop();
    runtime.unavailableLocalPorts.add(first.localPort);

    const route = await startTailnetRoute("nested-worktree", runtime);
    expect(route.localPort).not.toBe(first.localPort);
    expect(route.publicUrl).toMatch(/^http:\/\/100\.80\.135\.9:45\d{3}$/);
    expect(runtime.routes.get(route.publicPort)).toBe(`127.0.0.1:${route.localPort}`);
  });

  it("removes only its own route", async () => {
    const runtime = new FakeTailnetRuntime();
    const route = await startTailnetRoute("owned-worktree", runtime);
    runtime.routes.set(route.publicPort, "127.0.0.1:49999");
    await route.stop();
    expect(runtime.routes.get(route.publicPort)).toBe("127.0.0.1:49999");
  });

  it("cleans up the exact route it started", async () => {
    const runtime = new FakeTailnetRuntime();
    const route = await startTailnetRoute("flat-project", runtime);
    await route.stop();
    expect(runtime.routes.has(route.publicPort)).toBe(false);
  });

  it("keeps simultaneous previews on different routes", async () => {
    const runtime = new FakeTailnetRuntime();
    const [first, second] = await Promise.all([
      startTailnetRoute("same-worktree", runtime),
      startTailnetRoute("same-worktree", runtime),
    ]);
    expect(second.publicPort).not.toBe(first.publicPort);
    expect(second.localPort).not.toBe(first.localPort);
  });

  it("rolls back a created route when verification fails", async () => {
    const runtime = new FakeTailnetRuntime();
    runtime.failStatusAfterCreate = true;
    await expect(startTailnetRoute("verification-failure", runtime)).rejects.toThrow("status unavailable");
    expect(runtime.routes.size).toBe(0);
  });
});

class FakeTailnetRuntime implements TailnetRuntime {
  routes = new Map<number, string>();
  unavailableLocalPorts = new Set<number>();
  failStatusAfterCreate = false;
  private throwOnNextStatus = false;
  private lock = Promise.resolve();

  output(args: string[]): string {
    if (args[0] === "ip") return "100.80.135.9\n";
    if (this.throwOnNextStatus) {
      this.throwOnNextStatus = false;
      throw new Error("status unavailable");
    }
    return JSON.stringify({
      TCP: Object.fromEntries([...this.routes].map(([port, target]) => [port, { TCPForward: target }])),
    });
  }

  run(args: string[]): void {
    const port = Number(args.find((argument) => argument.startsWith("--tcp="))?.split("=")[1]);
    if (args.at(-1) === "off") this.routes.delete(port);
    else {
      this.routes.set(port, args.at(-1)?.replace("tcp://", "") ?? "");
      if (this.failStatusAfterCreate) this.throwOnNextStatus = true;
    }
  }

  async localPortAvailable(port: number): Promise<boolean> {
    return !this.unavailableLocalPorts.has(port);
  }

  async withAllocationLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.lock;
    let release = () => {};
    this.lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
