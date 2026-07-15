import { DesignSpaceError } from "./errors";

const forbiddenCharacters = /[\0-\x1f\x7f'"`{};<>\\]/;
const allowedToken = /^[a-zA-Z0-9_!@#$%&*+,.\-/:=\[\]()|~?]+$/;
const maximumClassTokens = 256;

function balanced(token: string, open: string, close: string): boolean {
  let depth = 0;
  for (const character of token) {
    if (character === open) depth += 1;
    if (character === close && --depth < 0) return false;
  }
  return depth === 0;
}

export function validateTailwindClassList(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (value.length > 10_000 || forbiddenCharacters.test(value)) {
    throw new DesignSpaceError("INVALID_TAILWIND", "The class list contains unsafe characters");
  }
  if (normalized === "") return normalized;

  const tokens = normalized.split(" ");
  if (tokens.length > maximumClassTokens) {
    throw new DesignSpaceError("INVALID_TAILWIND", "The class list contains too many utilities");
  }
  const seen = new Set<string>();
  for (const token of tokens) {
    if (
      token.length > 300 ||
      !allowedToken.test(token) ||
      !balanced(token, "[", "]") ||
      !balanced(token, "(", ")")
    ) {
      throw new DesignSpaceError("INVALID_TAILWIND", `Invalid Tailwind class token: ${token}`);
    }
    if (seen.has(token)) {
      throw new DesignSpaceError("INVALID_TAILWIND", `Duplicate Tailwind class: ${token}`);
    }
    seen.add(token);
  }
  return normalized;
}
