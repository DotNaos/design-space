import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve, sep } from "node:path";

import { SourceCodexAppServerError } from "./source-codex-app-server";

const maximumAttachmentBytes = 8 * 1024 * 1024;
const maximumAttachmentsPerMessage = 4;
const attachmentDirectory = join(tmpdir(), "design-space-codex-attachments");

const supportedImages = {
  "image/gif": { extension: ".gif", signature: (bytes: Buffer) => bytes.subarray(0, 3).toString("ascii") === "GIF" },
  "image/jpeg": { extension: ".jpg", signature: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: ".png", signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: ".webp", signature: (bytes: Buffer) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;

type SupportedImageType = keyof typeof supportedImages;

export async function storeSourceCodexImage(input: {
  dataUrl: string;
  fileName?: string;
  mediaType: string;
}): Promise<{ path: string }> {
  const mediaType = input.mediaType.toLowerCase() as SupportedImageType;
  const definition = supportedImages[mediaType];
  if (!definition) throw new SourceCodexAppServerError("Only PNG, JPEG, WebP, and GIF screenshots are supported.", 415);
  const match = input.dataUrl.match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i);
  if (!match || match[1].toLowerCase() !== mediaType) {
    throw new SourceCodexAppServerError("The screenshot data is invalid.", 400);
  }
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.byteLength > maximumAttachmentBytes) {
    throw new SourceCodexAppServerError("Screenshots must be smaller than 8 MB.", 413);
  }
  if (!definition.signature(bytes)) {
    throw new SourceCodexAppServerError("The screenshot contents do not match its image type.", 400);
  }

  await mkdir(attachmentDirectory, { mode: 0o700, recursive: true });
  const requestedExtension = extname(input.fileName ?? "").toLowerCase();
  const extension = requestedExtension === definition.extension ? requestedExtension : definition.extension;
  const path = join(attachmentDirectory, `${randomUUID()}${extension}`);
  await writeFile(path, bytes, { mode: 0o600 });
  return { path };
}

export async function validateSourceCodexImagePaths(paths: readonly string[]): Promise<string[]> {
  if (paths.length > maximumAttachmentsPerMessage) {
    throw new SourceCodexAppServerError("A message can include up to 4 screenshots.", 400);
  }
  if (!paths.length) return [];
  const root = await realpath(resolve(attachmentDirectory));
  const validated: string[] = [];
  for (const candidate of paths) {
    const path = await realpath(resolve(candidate)).catch(() => undefined);
    if (!path || !isWithin(root, path)) {
      throw new SourceCodexAppServerError("The screenshot attachment is not trusted.", 403);
    }
    const evidence = await lstat(path);
    if (!evidence.isFile() || evidence.size > maximumAttachmentBytes) {
      throw new SourceCodexAppServerError("The screenshot attachment is invalid.", 400);
    }
    validated.push(path);
  }
  return validated;
}

function isWithin(root: string, candidate: string): boolean {
  const distance = relative(root, candidate);
  return Boolean(distance)
    && distance !== ".."
    && !distance.startsWith(`..${sep}`)
    && resolve(root, distance) === candidate;
}
