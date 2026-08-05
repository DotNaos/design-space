import { existsSync } from "node:fs";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";

import ts from "typescript";
import type { Alias } from "vite";

/** Converts target-owned TypeScript path aliases into Vite aliases. */
export function targetTypeScriptAliases(projectRoot: string): Alias[] {
  const appConfig = resolve(projectRoot, "tsconfig.app.json");
  const configPath = existsSync(appConfig) ? appConfig : resolve(projectRoot, "tsconfig.json");
  if (!existsSync(configPath)) return [];
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return [];
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot, undefined, configPath);
  const baseUrl = resolve(projectRoot, parsed.options.baseUrl ?? ".");
  const aliases: Alias[] = [];
  for (const [pattern, replacements] of Object.entries(parsed.options.paths ?? {})) {
    const replacement = replacements?.[0];
    if (!replacement) continue;
    if (pattern.endsWith("/*") && replacement.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      aliases.push({ find: new RegExp(`^${escapeRegExp(prefix)}`), replacement: `${resolve(baseUrl, replacement.slice(0, -1))}/` });
      continue;
    }
    if (!pattern.includes("*") && !replacement.includes("*")) {
      aliases.push({ find: new RegExp(`^${escapeRegExp(pattern)}$`), replacement: resolve(baseUrl, replacement) });
    }
  }
  return aliases;
}

/** Returns the trusted source roots reached by the aliases above. */
export function targetTypeScriptAliasRoots(aliases: readonly Alias[]): string[] {
  return [...new Set(aliases.flatMap((alias) => {
    if (typeof alias.replacement !== "string") return [];
    const replacement = alias.replacement.endsWith("/")
      ? alias.replacement.slice(0, -1)
      : alias.replacement;
    if (!existsSync(replacement)) return [dirname(replacement)];
    return [statSync(replacement).isDirectory() ? replacement : dirname(replacement)];
  }))];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
