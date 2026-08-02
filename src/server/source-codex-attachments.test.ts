import { readFile, realpath, rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  storeSourceCodexImage,
  validateSourceCodexImagePaths,
} from "./source-codex-attachments";

const storedPaths: string[] = [];

afterEach(async () => {
  await Promise.all(storedPaths.splice(0).map((path) => rm(path, { force: true })));
});

describe("source Codex screenshot attachments", () => {
  it("stores validated images in the trusted local attachment folder", async () => {
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const stored = await storeSourceCodexImage({
      dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      fileName: "canvas.png",
      mediaType: "image/png",
    });
    storedPaths.push(stored.path);

    await expect(readFile(stored.path)).resolves.toEqual(bytes);
    await expect(validateSourceCodexImagePaths([stored.path])).resolves.toEqual([await realpath(stored.path)]);
  });

  it("rejects disguised images and paths outside the trusted attachment folder", async () => {
    await expect(storeSourceCodexImage({
      dataUrl: `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`,
      fileName: "fake.png",
      mediaType: "image/png",
    })).rejects.toMatchObject({ status: 400 });
    await expect(validateSourceCodexImagePaths([import.meta.filename])).rejects.toMatchObject({ status: 403 });
  });
});
