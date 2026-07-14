import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { registerTrustedTarget, type TrustedTargetConfig } from "./target-registration";
import { TailwindIntelligenceService } from "./tailwind-intelligence-service";

it("disposes the language-server connection while initialization is still pending", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-space-intelligence-lifecycle-"));
  try {
    await writeFile(join(root, "target.tsx"), "export const target = {};\n", "utf8");
    await writeFile(join(root, "tailwind.css"), '@import "tailwindcss";\n', "utf8");
    const target = await registerTrustedTarget({
      project: { id: "demo", label: "Demo" },
      root,
      targetModule: "target.tsx",
      files: { "tailwind.intelligence": "tailwind.css" },
      editTargets: {},
      tailwindCompiler: {
        sourceFileIds: ["tailwind.intelligence"],
        intelligenceFileId: "tailwind.intelligence",
        compile: () => "",
      },
    } satisfies TrustedTargetConfig);
    let releaseInitialize = () => {};
    const initialize = new Promise<unknown>((resolve) => {
      releaseInitialize = () => resolve({ capabilities: {} });
    });
    let initializeStarted = false;
    let disposals = 0;
    const client = {
      request<T>(method: string): Promise<T> {
        if (method !== "initialize") throw new Error(`Unexpected request: ${method}`);
        initializeStarted = true;
        return initialize as Promise<T>;
      },
      notify() {},
      onNotification() {
        return () => {};
      },
      dispose() {},
    };
    const service = new TailwindIntelligenceService(target, {
      createConnection: () => ({
        client,
        dispose: () => {
          disposals += 1;
        },
      }),
      idleTimeoutMs: 60_000,
    });

    try {
      const analysis = service.analyze("p", 1);
      await vi.waitFor(() => expect(initializeStarted).toBe(true));
      const rejectedAnalysis = expect(analysis).rejects.toMatchObject({
        message: expect.stringContaining("shut down"),
      });
      service.dispose();

      expect(disposals).toBe(1);
      await rejectedAnalysis;
      releaseInitialize();
      await new Promise((resolve) => setImmediate(resolve));
      expect(disposals).toBe(1);
    } finally {
      service.dispose();
      releaseInitialize();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
