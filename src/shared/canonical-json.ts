export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

function normalize(value: unknown, seen: Set<object>): CanonicalJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON accepts only finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (!value || typeof value !== "object") {
    throw new TypeError("Canonical JSON accepts only JSON values");
  }
  if (seen.has(value)) throw new TypeError("Canonical JSON does not accept circular values");
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => normalize(item, seen));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON accepts only plain objects");
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize((value as Record<string, unknown>)[key], seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown, indentation = 0): string {
  if (!Number.isInteger(indentation) || indentation < 0 || indentation > 10) {
    throw new TypeError("Canonical JSON indentation must be between zero and ten");
  }
  return JSON.stringify(normalize(value, new Set()), null, indentation);
}
