import { createHash } from "node:crypto";

import { DesignSpaceError } from "./errors";

export function sourceVersion(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function escapeExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface LocatedValue {
  value: string;
  nextSource: (replacement: string) => string;
}

export function locateMarkedString(source: string, marker: string): LocatedValue {
  const expression = new RegExp(`${escapeExpression(marker)}(\\s*)(["'])([^"'\\r\\n]*)\\2`);
  const match = expression.exec(source);
  if (!match || match.index === undefined) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "The registered edit marker has no string value");
  }
  const valueStart = match.index + marker.length + match[1].length + 1;
  const valueEnd = valueStart + match[3].length;
  return {
    value: match[3],
    nextSource: (replacement) => `${source.slice(0, valueStart)}${replacement}${source.slice(valueEnd)}`,
  };
}
