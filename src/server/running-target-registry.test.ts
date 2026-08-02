import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RunningTargetRegistry, isTrustedInstanceUrl } from "./running-target-registry";

describe("running target registry", () => {
  const roots: string[] = [];
  const registries: RunningTargetRegistry[] = [];
  afterEach(async () => {
    await Promise.all(registries.splice(0).map((registry) => registry.stop()));
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("stores private leases and returns only health-verified peers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "design-space-running-"));
    roots.push(directory);
    let second: RunningTargetRegistry;
    const first = new RunningTargetRegistry(
      { id: "design-space", label: "Design Space" },
      "http://design-space.localhost:1355",
      {
        directory,
        fetch: (async () => Response.json(second.healthPayload())) as unknown as typeof fetch,
      },
    );
    second = new RunningTargetRegistry(
      { id: "project-space", label: "Project Space" },
      "http://project-space-design-space.localhost:1355",
      { directory },
    );
    registries.push(first, second);
    await first.start();
    await second.start();

    const targets = await first.verifiedTargets();
    expect(targets.map((target) => [target.project.id, target.current])).toEqual([
      ["design-space", true],
      ["project-space", false],
    ]);
    const names = (await import("node:fs/promises")).readdir(directory);
    for (const name of await names) {
      const mode = (await stat(join(directory, name))).mode & 0o777;
      expect(mode).toBe(0o600);
      expect(JSON.parse(await readFile(join(directory, name), "utf8"))).not.toHaveProperty("root");
    }
  });

  it("rejects non-local or path-bearing advertised URLs", () => {
    expect(isTrustedInstanceUrl("http://design-space.localhost:1355")).toBe(true);
    expect(isTrustedInstanceUrl("https://example.com")).toBe(false);
    expect(isTrustedInstanceUrl("http://design-space.localhost:1355/private")).toBe(false);
  });
});
