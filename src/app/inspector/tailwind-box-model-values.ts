import type { CSSProperties } from "react";

import { replaceTailwindUtilityGroup } from "./tailwind-utility";

export type BoxKind = "margin" | "border" | "padding";
export type BoxSide = "top" | "right" | "bottom" | "left";
export type BoxCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";
export type BoxUnit = "tailwind" | "rem" | "px";

export interface BoxModelPreview {
  className: string;
  kind: BoxKind;
}

export const boxUnits: readonly BoxUnit[] = ["tailwind", "rem", "px"];
export const rootFontSizePixels = 16;
export const tailwindSpacingUnitPixels = 4;

const prefix: Record<BoxKind, string> = { margin: "m", border: "border", padding: "p" };
const sideSuffix: Record<BoxSide, string> = { top: "t", right: "r", bottom: "b", left: "l" };

/** Every Tailwind spacing token is readable; only the coarse ladder below is reachable by dragging. */
const scalePixels: Record<string, string> = {
  "0": "0",
  px: "1px",
  "0.5": "2px",
  "1": "4px",
  "1.5": "6px",
  "2": "8px",
  "2.5": "10px",
  "3": "12px",
  "3.5": "14px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "7": "28px",
  "8": "32px",
  "9": "36px",
  "10": "40px",
  "11": "44px",
  "12": "48px",
  "14": "56px",
  "16": "64px",
  "20": "80px",
  "24": "96px",
  "28": "112px",
  "32": "128px",
  "36": "144px",
  "40": "160px",
  "44": "176px",
  "48": "192px",
  "52": "208px",
  "56": "224px",
  "60": "240px",
  "64": "256px",
  "72": "288px",
  "80": "320px",
  "96": "384px",
};

const spacingScaleTokens = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  "12", "14", "16", "20", "24", "28", "32", "36", "40", "44", "48", "52", "56", "60", "64", "72", "80", "96",
] as const;
const spacingLadder: readonly number[] = spacingScaleTokens.map((token) => Number.parseFloat(scalePixels[token]!));
const borderLadder: readonly number[] = [0, 1, 2, 4, 8];
const minimumHitSize = 12;
const cornerHitSize = 14;

/**
 * `band` is what the target centres on, `span` is how wide it ends up. Keeping those apart is what
 * makes an indicator grow to both sides of the outline; centring on `span` instead would push it
 * outward by half its own growth.
 */
export function hitBox(side: BoxSide, band: number, span: number): CSSProperties {
  const size = Math.max(span, minimumHitSize);
  const offset = -band / 2 - size / 2;
  if (side === "top") return { height: size, left: 0, right: 0, top: offset, width: "auto" };
  if (side === "bottom") return { bottom: offset, height: size, left: 0, right: 0, width: "auto" };
  if (side === "left") return { bottom: 0, height: "auto", left: offset, top: 0, width: size };
  return { bottom: 0, height: "auto", right: offset, top: 0, width: size };
}

export function cornerBox(corner: BoxCorner, thickness: { x: number; y: number }): CSSProperties {
  const half = cornerHitSize / 2;
  return {
    ...(corner.startsWith("top")
      ? { top: -thickness.y / 2 - half }
      : { bottom: -thickness.y / 2 - half }),
    ...(corner.endsWith("Left")
      ? { left: -thickness.x / 2 - half }
      : { right: -thickness.x / 2 - half }),
    height: cornerHitSize,
    width: cornerHitSize,
  };
}

export function keyboardStep(key: string): number | "zero" | undefined {
  if (key === "ArrowUp" || key === "ArrowRight") return 1;
  if (key === "ArrowDown" || key === "ArrowLeft") return -1;
  if (key === "PageUp") return 4;
  if (key === "PageDown") return -4;
  if (key === "Home") return "zero";
  return undefined;
}

export function isHorizontal(side: BoxSide): boolean {
  return side === "top" || side === "bottom";
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function boxLadder(kind: BoxKind): readonly number[] {
  if (kind === "border") return borderLadder;
  // Negative margin is valid CSS, but is intentionally outside the first editor contract.
  // Reintroduce it here only when every slider, drag gesture, field, and source preview can
  // represent negative spacing consistently. Padding remains non-negative by CSS definition.
  return spacingLadder;
}

export function nearestLadderIndex(kind: BoxKind, pixels: number): number {
  const steps = boxLadder(kind);
  return steps.reduce((nearest, step, position) => (
    Math.abs(step - pixels) < Math.abs((steps[nearest] ?? 0) - pixels) ? position : nearest
  ), 0);
}

export function parsePixelValue(value: string): number | undefined {
  if (!value || value === "0") return 0;
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : undefined;
}

export function parseBoxLengthPixels(value: string): number | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "0") return 0;
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|rem)$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return match[2] === "rem" ? amount * rootFontSizePixels : amount;
}

export function formatBoxUnitValue(value: string, kind: BoxKind, unit: BoxUnit): string {
  const pixels = parseBoxLengthPixels(value);
  if (pixels === undefined) return value || "0";
  const amount = unit === "tailwind"
    ? pixels / (kind === "border" ? 1 : tailwindSpacingUnitPixels)
    : unit === "rem"
      ? pixels / rootFontSizePixels
      : pixels;
  const formatted = formatNumber(amount);
  return unit === "tailwind" ? formatted : `${formatted} ${unit}`;
}

export function parseBoxUnitValue(value: string, kind: BoxKind, unit: BoxUnit): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  const explicit = parseBoxLengthPixels(normalized.replace(/\s+(px|rem)$/i, "$1"));
  if (explicit !== undefined && /(?:px|rem)$/i.test(normalized)) return `${formatNumber(explicit)}px`;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return value.trim();
  const pixels = unit === "tailwind"
    ? amount * (kind === "border" ? 1 : tailwindSpacingUnitPixels)
    : unit === "rem"
      ? amount * rootFontSizePixels
      : amount;
  return `${formatNumber(pixels)}px`;
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  return Number(value.toFixed(4)).toString();
}

export function outwardDelta(side: BoxSide, x: number, y: number): number {
  if (side === "top") return -y;
  if (side === "right") return x;
  if (side === "bottom") return y;
  return -x;
}

export function cornerDelta(corner: BoxCorner, x: number, y: number): number {
  const horizontal = corner.endsWith("Left") ? -x : x;
  const vertical = corner.startsWith("top") ? -y : y;
  return (horizontal + vertical) / 2;
}

export function snapBoxPixels(kind: BoxKind, value: number): number {
  const steps = boxLadder(kind);
  return steps[nearestLadderIndex(kind, value)] ?? 0;
}

export function readBoxValue(className: string, kind: BoxKind, side: BoxSide): string {
  return readBoxSource(className, kind, side).value;
}

export function changedBoxModelKind(current: string, next: string): BoxKind | undefined {
  const kinds: readonly BoxKind[] = ["margin", "border", "padding"];
  const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
  return kinds.find((kind) => sides.some((side) => readBoxValue(current, kind, side) !== readBoxValue(next, kind, side)));
}

export function readBoxSource(className: string, kind: BoxKind, side: BoxSide): { token: string; value: string } {
  const tokens = className.split(/\s+/).filter((token) => token && !hasVariant(token));
  for (const candidate of boxCandidates(kind, side)) {
    const token = [...tokens].reverse().find((utility) => candidate.pattern.test(utility));
    if (token) return { token, value: displayBoxValue(token, candidate.utilityPrefix) };
  }
  return { token: "", value: "" };
}

export function setBoxValue(className: string, kind: BoxKind, side: BoxSide, rawValue: string): string {
  const sidePrefix = `${prefix[kind]}${kind === "border" ? `-${sideSuffix[side]}` : sideSuffix[side]}`;
  const next = boxUtility(sidePrefix, rawValue, kind);
  const sidePattern = kind === "border"
    ? borderWidthPattern(sideSuffix[side])
    : new RegExp(`^-?${sidePrefix}-.+$`);
  return replaceTailwindUtilityGroup(className, [], next, (utility) => sidePattern.test(utility));
}

export function setBoxUniformValue(className: string, kind: BoxKind, rawValue: string): string {
  const next = boxUtility(prefix[kind], rawValue, kind);
  const pattern = boxKindPattern(kind);
  return replaceTailwindUtilityGroup(className, [], next, (utility) => pattern.test(utility));
}

export type BoxAxis = "x" | "y";

export const axisSides: Record<BoxAxis, readonly BoxSide[]> = {
  x: ["left", "right"],
  y: ["top", "bottom"],
};

/** The axis value, or `undefined` when its two sides disagree and cannot be shown as one number. */
export function readBoxAxis(className: string, kind: BoxKind, axis: BoxAxis): string | undefined {
  const [first, second] = axisSides[axis].map((side) => readBoxValue(className, kind, side));
  return first === second ? first : undefined;
}

/** Writes the `px-*` / `py-*` shorthand and clears the per-side utilities it would otherwise lose to. */
export function setBoxAxisValue(className: string, kind: BoxKind, axis: BoxAxis, rawValue: string): string {
  const axisPrefix = kind === "border" ? `border-${axis}` : `${prefix[kind]}${axis}`;
  const next = boxUtility(axisPrefix, rawValue, kind);
  const sideNames = axisSides[axis].map((side) => sideSuffix[side]);
  const pattern = kind === "border"
    ? new RegExp(`^border-(?:${axis}|${sideNames.join("|")})(?:-(?:0|2|4|8|\\[[^\\]]+\\]))?$`)
    : new RegExp(`^-?${prefix[kind]}(?:${axis}|${sideNames.join("|")})-.+$`);
  return replaceTailwindUtilityGroup(className, [], next, (utility) => pattern.test(utility));
}

function boxCandidates(kind: BoxKind, side: BoxSide): Array<{ pattern: RegExp; utilityPrefix: string }> {
  if (kind === "border") {
    const sideName = sideSuffix[side];
    return [
      { pattern: borderWidthPattern(sideName), utilityPrefix: `border-${sideName}` },
      { pattern: /^border(?:-(?:0|2|4|8|\[(?:-?\d+(?:\.\d+)?(?:px|rem|em|%)?|var\(.+\))\]))?$/, utilityPrefix: "border" },
    ];
  }
  const base = prefix[kind];
  const axis = side === "left" || side === "right" ? "x" : "y";
  return [
    { pattern: new RegExp(`^-?${base}${sideSuffix[side]}-.+$`), utilityPrefix: `${base}${sideSuffix[side]}` },
    { pattern: new RegExp(`^-?${base}${axis}-.+$`), utilityPrefix: `${base}${axis}` },
    { pattern: new RegExp(`^-?${base}-.+$`), utilityPrefix: base },
  ];
}

function borderWidthPattern(side: string): RegExp {
  return new RegExp(`^border-${side}(?:-(?:0|2|4|8|\\[(?:-?\\d+(?:\\.\\d+)?(?:px|rem|em|%)?|var\\(.+\\))\\]))?$`);
}

function boxKindPattern(kind: BoxKind): RegExp {
  if (kind === "border") {
    return /^border(?:-(?:t|r|b|l|x|y|s|e))?(?:-(?:0|2|4|8|\[(?:-?\d+(?:\.\d+)?(?:px|rem|em|%)?|var\(.+\))\]))?$/;
  }
  return new RegExp(`^-?${prefix[kind]}(?:t|r|b|l|x|y|s|e)?-.+$`);
}

function displayBoxValue(token: string, utilityPrefix: string): string {
  const negative = token.startsWith("-");
  const normalized = negative ? token.slice(1) : token;
  if (normalized === utilityPrefix || normalized === "border") return "1px";
  const suffix = normalized.slice(utilityPrefix.length + 1);
  const arbitrary = suffix.match(/^\[(.+)\]$/)?.[1];
  if (arbitrary) return arbitrary.replace(/_/g, " ");
  if (utilityPrefix.startsWith("border")) return `${suffix}px`;
  const value = scalePixels[suffix] ?? suffix;
  return negative && value !== "0" ? `-${value}` : value;
}

function boxUtility(utilityPrefix: string, rawValue: string, kind: BoxKind): string {
  const value = supportedBoxValue(rawValue);
  if (!value) return "";
  if (value === "0" || value === "0px" || value === "0rem") return `${utilityPrefix}-0`;
  if (kind === "border") {
    if (value === "1px") return utilityPrefix;
    const width = value.match(/^(0|2|4|8)px$/)?.[1];
    if (width) return `${utilityPrefix}-${width}`;
  }
  if (value === "auto" && kind !== "border") return `${utilityPrefix}-auto`;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return `${utilityPrefix}-[${value}px]`;
  const negativePixels = value.match(/^-([\d.]+px)$/)?.[1];
  const negativeScale = negativePixels
    ? Object.entries(scalePixels).find(([, pixels]) => pixels === negativePixels)?.[0]
    : undefined;
  if (negativeScale && kind === "margin") return `-${utilityPrefix}-${negativeScale}`;
  const scale = Object.entries(scalePixels).find(([, pixels]) => pixels === value)?.[0];
  if (scale && kind !== "border") return `${utilityPrefix}-${scale}`;
  return `${utilityPrefix}-[${value.replace(/\s+/g, "_")}]`;
}

function supportedBoxValue(rawValue: string): string {
  const value = rawValue.trim();
  return value.startsWith("-") ? "0px" : value;
}

function hasVariant(token: string): boolean {
  let depth = 0;
  for (const character of token) {
    if (character === "[") depth += 1;
    else if (character === "]") depth = Math.max(0, depth - 1);
    else if (character === ":" && depth === 0) return true;
  }
  return false;
}
