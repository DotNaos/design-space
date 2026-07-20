import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { expect, it, vi } from "vitest";

import { LibraryRuntimeService } from "./library-runtime-service";

const registration = {
  packageName: "@dotnaos/react-ui",
  release: { version: "0.0.5" },
  development: {
    root: "/trusted/ui",
    command: ["bun", "run", "dev"] as const,
    portlessName: "dotnaos-ui-storybook",
  },
};

it("reports the installed package while development is stopped", async () => {
  const service = new LibraryRuntimeService(registration, { resolveUrl: async () => undefined });

  await expect(service.status()).resolves.toEqual({
    packageName: "@dotnaos/react-ui",
    release: { version: "0.0.5" },
    development: { configured: true, managed: false, state: "stopped" },
  });
});

it("starts only the fixed registered command and can stop its owned process", async () => {
  const child = fakeChild();
  const spawn = vi.fn(() => child) as unknown as typeof import("node:child_process").spawn;
  const service = new LibraryRuntimeService(registration, { resolveUrl: async () => undefined, spawn });

  await expect(service.execute({ type: "start-library-development" })).resolves.toMatchObject({
    development: { configured: true, managed: true, state: "starting" },
  });
  expect(spawn).toHaveBeenCalledWith("bun", ["run", "dev"], expect.objectContaining({ cwd: "/trusted/ui" }));

  await expect(service.execute({ type: "stop-library-development" })).resolves.toMatchObject({
    development: { managed: false, state: "stopped" },
  });
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
});

it("attaches to an already running development library without claiming process ownership", async () => {
  const service = new LibraryRuntimeService(registration, {
    resolveUrl: async () => "http://dotnaos-ui-storybook.localhost:1355",
    fetch: vi.fn(async (input) => String(input).endsWith("/index.json")
      ? new Response(JSON.stringify({ entries: { "button--primary": { type: "story", name: "Primary", title: "@dotnaos/react-ui/Primitives/Button" } } }), { status: 200 })
      : new Response(null, { status: 200 })) as unknown as typeof fetch,
  });

  await expect(service.status()).resolves.toMatchObject({
    development: {
      managed: false,
      state: "running",
      url: "http://dotnaos-ui-storybook.localhost:1355",
      components: [{ id: "button--primary", label: "Primary", group: "Primitives/Button" }],
    },
  });
});

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => true);
  return child;
}
