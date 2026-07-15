import { DesignSpaceError } from "./errors";

const forbiddenCharacters = /[\0-\x1f\x7f'"`{};<>\\]/;
const allowedToken = /^[a-zA-Z0-9_!@#$%&*+,.\-/:=\[\]()|~?]+$/;

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

  for (const token of normalized.split(" ")) {
    if (
      token.length > 300 ||
      !allowedToken.test(token) ||
      !balanced(token, "[", "]") ||
      !balanced(token, "(", ")")
    ) {
      throw new DesignSpaceError("INVALID_TAILWIND", `Invalid Tailwind class token: ${token}`);
    }
  }
  return normalized;
}
