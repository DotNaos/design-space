export type SourcePreviewMode = "design" | "play";
export type SourceWorkspaceMode = "preview" | "design";

export interface SourceLayerMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SourceLayerPaint = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  textColor: string;
};

export function sourceLayerPaint(className: string): SourceLayerPaint {
  const tokens = baseUtilities(className);
  return {
    fill: utilityValue(findLast(tokens, backgroundColorPattern), "bg") ?? "",
    stroke: utilityValue(findLast(tokens, borderColorPattern), "border") ?? "",
    strokeWidth: borderWidth(tokens),
    textColor: utilityValue(findLast(tokens, textColorPattern), "text") ?? "",
  };
}

export function setSourceLayerDimension(className: string, axis: "width" | "height", value: number): string {
  const prefix = axis === "width" ? "w" : "h";
  return replaceBaseUtility(className, new RegExp(`^${prefix}-.+$`), `${prefix}-[${Math.max(0, Math.round(value))}px]`);
}

export function setSourceLayerFill(className: string, value: string): string {
  return replaceBaseUtility(className, backgroundColorPattern, colorUtility("bg", value));
}

export function setSourceLayerStroke(className: string, value: string): string {
  return replaceBaseUtility(className, borderColorPattern, colorUtility("border", value));
}

export function setSourceLayerStrokeWidth(className: string, value: number): string {
  const width = Math.max(0, Math.round(value));
  return replaceBaseUtility(
    className,
    /^(?:border|border-(?:0|2|4|8|\[[0-9.]+px\]))$/,
    width === 0 ? "" : width === 1 ? "border" : `border-[${width}px]`,
  );
}

export function setSourceLayerTextColor(className: string, value: string): string {
  return replaceBaseUtility(className, textColorPattern, colorUtility("text", value));
}

function colorUtility(prefix: "bg" | "border" | "text", value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^(?:#|(?:rgb|hsl|oklch|color|var)\()/.test(normalized)) return `${prefix}-[${normalized}]`;
  return `${prefix}-${normalized}`;
}

function utilityValue(token: string | undefined, prefix: string): string | undefined {
  if (!token) return undefined;
  const match = token.match(new RegExp(`^${prefix}-\\[(.+)\\]$`));
  return match?.[1] ?? token.slice(prefix.length + 1);
}

function borderWidth(tokens: readonly string[]): number {
  const token = tokens.find((candidate) => /^(?:border|border-(?:0|2|4|8|\[[0-9.]+px\]))$/.test(candidate));
  if (!token || token === "border") return token ? 1 : 0;
  if (token === "border-0") return 0;
  const arbitrary = token.match(/^border-\[([0-9.]+)px\]$/)?.[1];
  return Number(arbitrary ?? token.slice("border-".length));
}

function baseUtilities(className: string): string[] {
  return className.split(/\s+/).filter((token) => token && !hasVariant(token));
}

function findLast(tokens: readonly string[], pattern: RegExp): string | undefined {
  return [...tokens].reverse().find((token) => pattern.test(token));
}

function replaceBaseUtility(className: string, matches: RegExp, next: string): string {
  const tokens = className.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let replaced = false;
  for (const token of tokens) {
    if (hasVariant(token) || !matches.test(token)) {
      output.push(token);
      continue;
    }
    if (!replaced && next) output.push(next);
    replaced = true;
  }
  if (!replaced && next) output.push(next);
  return output.join(" ");
}

function hasVariant(token: string): boolean {
  let bracketDepth = 0;
  for (const character of token) {
    if (character === "[") bracketDepth += 1;
    else if (character === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (character === ":" && bracketDepth === 0) return true;
  }
  return false;
}

const colorName = "(?:inherit|current|transparent|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
const colorValue = `(?:${colorName}(?:-\\d{2,3})?(?:\\/(?:\\d{1,3}|\\[[^\\]]+\\]))?|\\[(?:#|(?:rgb|hsl|oklch|color|var)\\().+\\]|\\(--[^)]+\\))`;
const backgroundColorPattern = new RegExp(`^bg-${colorValue}$`);
const borderColorPattern = new RegExp(`^border-${colorValue}$`);
const textColorPattern = new RegExp(`^text-${colorValue}$`);
