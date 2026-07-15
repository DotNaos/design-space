import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { createServer as createViteServer } from "vite";
import { expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

it("keeps trusted server files outside the real Vite browser surface", async () => {
  const previousDirect = process.env.DESIGN_SPACE_ALLOW_DIRECT;
  process.env.DESIGN_SPACE_ALLOW_DIRECT = "1";
  const vite = await createViteServer({
    configFile: resolve(root, "vite.config.ts"),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
  });
  const server = createHttpServer(vite.middlewares);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  const rawFile = (path: string) => `${origin}/@fs${path.replaceAll("\\", "/")}?raw`;

  try {
    await expect(fetch(`${origin}/src/main.tsx`)).resolves.toMatchObject({ status: 200 });
    for (const path of [
      resolve(root, "package.json"),
      resolve(root, "vite.config.ts"),
      resolve(root, "src/server/api-plugin.ts"),
      resolve(root, "examples/demo-target/design-space.server.ts"),
    ]) {
      const response = await fetch(rawFile(path));
      expect(response.status, path).toBe(403);
    }
    await expect(fetch(`${origin}/__open-in-editor?file=/etc/passwd`)).resolves.toMatchObject({ status: 403 });
  } finally {
    server.closeAllConnections();
    if (server.listening) {
      await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    }
    await vite.close();
    if (previousDirect === undefined) delete process.env.DESIGN_SPACE_ALLOW_DIRECT;
    else process.env.DESIGN_SPACE_ALLOW_DIRECT = previousDirect;
  }
}, 20_000);
