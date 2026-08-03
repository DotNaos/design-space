import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import type { RegisteredTarget } from "./target-registration";
import { LibraryReleaseService } from "./library-release-service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

it("lists published versions and installs an exact server-confirmed release", async () => {
  const fixture = await releaseFixture();
  const restart = vi.fn();
  const service = new LibraryReleaseService(fixture.target, {
    fetch: registryFetch(),
    restartDelayMs: 0,
    runInstall: async (manager, root) => {
      expect(manager).toBe("bun");
      expect(root).toBe(fixture.root);
      const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { dependencies: Record<string, string> };
      await writeFile(fixture.installedManifest, JSON.stringify({ version: manifest.dependencies[fixture.packageName] }));
    },
  });
  service.attachServer({ restart } as never);

  await expect(service.execute({ type: "get-library-releases" })).resolves.toMatchObject({
    currentVersion: "0.0.5",
    latestVersion: "0.0.6",
    requestedVersion: "^0.0.5",
    versions: [
      expect.objectContaining({ version: "0.0.6" }),
      expect.objectContaining({ version: "0.0.5" }),
      expect.objectContaining({ version: "0.0.4" }),
    ],
  });

  await expect(service.execute({ type: "install-library-release", version: "0.0.6" })).resolves.toMatchObject({
    currentVersion: "0.0.6",
    requestedVersion: "0.0.6",
  });
  expect(await dependencyVersion(join(fixture.root, "package.json"), fixture.packageName)).toBe("0.0.6");
  expect(await dependencyVersion(join(fixture.targetRoot, "package.json"), fixture.packageName)).toBe("0.0.6");
  await vi.waitFor(() => expect(restart).toHaveBeenCalledOnce());
});

it("rejects unknown versions without changing manifests", async () => {
  const fixture = await releaseFixture();
  const service = new LibraryReleaseService(fixture.target, { fetch: registryFetch() });

  await expect(service.execute({ type: "install-library-release", version: "9.9.9" })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  expect(await dependencyVersion(join(fixture.targetRoot, "package.json"), fixture.packageName)).toBe("^0.0.5");
});

it("restores package and lock files when installation fails", async () => {
  const fixture = await releaseFixture();
  const originalLock = await readFile(join(fixture.root, "bun.lock"), "utf8");
  const service = new LibraryReleaseService(fixture.target, {
    fetch: registryFetch(),
    runInstall: async (_manager, root) => {
      await writeFile(join(root, "bun.lock"), "broken lock");
      throw new Error("resolution failed");
    },
  });
  service.attachServer({ restart: vi.fn() } as never);

  await expect(service.execute({ type: "install-library-release", version: "0.0.4" })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  expect(await dependencyVersion(join(fixture.root, "package.json"), fixture.packageName)).toBe("^0.0.5");
  expect(await dependencyVersion(join(fixture.targetRoot, "package.json"), fixture.packageName)).toBe("^0.0.5");
  expect(await readFile(join(fixture.root, "bun.lock"), "utf8")).toBe(originalLock);
});

async function releaseFixture() {
  const root = await mkdtemp(join(tmpdir(), "design-space-release-"));
  temporaryDirectories.push(root);
  const packageName = "@dotnaos/react-ui";
  const targetRoot = join(root, "examples", "source-target");
  const installedManifest = join(root, "node_modules", "@dotnaos", "react-ui", "package.json");
  await mkdir(join(targetRoot), { recursive: true });
  await mkdir(join(root, "node_modules", "@dotnaos", "react-ui"), { recursive: true });
  await writeFile(join(root, "package.json"), manifest(packageName, "^0.0.5"));
  await writeFile(join(root, "bun.lock"), "lockfile");
  await writeFile(join(targetRoot, "package.json"), manifest(packageName, "^0.0.5"));
  await writeFile(installedManifest, JSON.stringify({ version: "0.0.5" }));
  const target = {
    root: targetRoot,
    sourceLibrary: { packageName, release: { version: "^0.0.5" } },
  } as RegisteredTarget;
  return { installedManifest, packageName, root, target, targetRoot };
}

function registryFetch(): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify({
    "dist-tags": { latest: "0.0.6" },
    versions: {
      "0.0.4": {},
      "0.0.5": {},
      "0.0.6": {},
    },
    time: {
      "0.0.4": "2026-01-01T00:00:00.000Z",
      "0.0.5": "2026-02-01T00:00:00.000Z",
      "0.0.6": "2026-03-01T00:00:00.000Z",
    },
  }), { status: 200 })) as unknown as typeof fetch;
}

function manifest(packageName: string, version: string): string {
  return `${JSON.stringify({ private: true, dependencies: { [packageName]: version } }, null, 2)}\n`;
}

async function dependencyVersion(path: string, packageName: string): Promise<string | undefined> {
  const value = JSON.parse(await readFile(path, "utf8")) as { dependencies?: Record<string, string> };
  return value.dependencies?.[packageName];
}
