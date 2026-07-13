import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { compile } from "tailwindcss";

import type { TailwindPreview } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import { validateTailwindClassList } from "./tailwind";

const maximumCacheEntries = 100;
const selectorOnlyTokens = new Set(["dark", "group", "peer"]);
const cache = new Map<string, TailwindPreview>();
let themeSource: Promise<string> | undefined;
const require = createRequire(import.meta.url);

export async function compileTailwindPreview(unsafeValue: string): Promise<TailwindPreview> {
  const value = validateTailwindClassList(unsafeValue);
  if (/url\(|image\(|@import/i.test(value)) {
    throw new DesignSpaceError("INVALID_TAILWIND", "External CSS resources are not allowed in a preview");
  }
  const cached = cache.get(value);
  if (cached) return cached;

  const tokens = value ? value.split(" ") : [];
  const css = await build(tokens);
  for (const token of tokens) {
    if (!selectorOnlyTokens.has(token) && (await build([token])) === (await build([]))) {
      throw new DesignSpaceError("INVALID_TAILWIND", `Unknown Tailwind class: ${token}`);
    }
  }
  const preview = { value, css };
  if (cache.size >= maximumCacheEntries) cache.delete(cache.keys().next().value ?? "");
  cache.set(value, preview);
  return preview;
}

async function build(tokens: readonly string[]): Promise<string> {
  const compiler = await compile(`${await getThemeSource()}\n@tailwind utilities;`);
  return compiler.build([...tokens]);
}

function getThemeSource(): Promise<string> {
  themeSource ??= readFile(require.resolve("tailwindcss/theme.css"), "utf8");
  return themeSource;
}
