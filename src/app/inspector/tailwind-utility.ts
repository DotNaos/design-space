export type TailwindImportance = "prefix" | "suffix" | undefined;

export function replaceTailwindUtilityGroup(
  current: string,
  group: readonly string[],
  next: string,
  matches: (utility: string) => boolean = (utility) => group.includes(utility),
): string {
  const candidates = new Set(group);
  const tokens = current.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let replaced = false;

  for (const token of tokens) {
    const parsed = parseTailwindToken(token);
    const belongsToGroup = !parsed.modified && (candidates.has(parsed.utility) || matches(parsed.utility));
    if (!belongsToGroup) {
      result.push(token);
      continue;
    }
    if (!replaced && next) result.push(withImportance(next, parsed.importance));
    replaced = true;
  }

  if (!replaced && next) result.push(next);
  return result.join(" ");
}

export function parseTailwindToken(token: string) {
  let bracketDepth = 0;
  let variantEnd = -1;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "[") bracketDepth += 1;
    else if (token[index] === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (token[index] === ":" && bracketDepth === 0) variantEnd = index;
  }
  const rawUtility = token.slice(variantEnd + 1);
  const importance: TailwindImportance = rawUtility.startsWith("!")
    ? "prefix"
    : rawUtility.endsWith("!")
      ? "suffix"
      : undefined;
  return {
    modified: variantEnd >= 0,
    utility: rawUtility.replace(/^!/, "").replace(/!$/, ""),
    importance,
  } as const;
}

function withImportance(value: string, importance: TailwindImportance): string {
  if (importance === "prefix") return `!${value}`;
  if (importance === "suffix") return `${value}!`;
  return value;
}
