import { Input, Label, TextField } from "@heroui/react";

import { replaceTailwindUtilityGroup } from "./tailwind-utility";

type BoxKind = "margin" | "border" | "padding";
type BoxSide = "top" | "right" | "bottom" | "left";

const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
const prefix: Record<BoxKind, string> = { margin: "m", border: "border", padding: "p" };
const sideSuffix: Record<BoxSide, string> = { top: "t", right: "r", bottom: "b", left: "l" };
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
  "8": "32px",
  "10": "40px",
  "12": "48px",
  "16": "64px",
  "20": "80px",
  "24": "96px",
};

export function TailwindBoxModelControl(props: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] text-zinc-600">Box model</span>
        <span className="text-[8px] text-zinc-600">px, auto, or var(…)</span>
      </div>
      <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
        <BoxRow kind="margin" value={props.value} onChange={props.onChange} />
        <BoxRow kind="border" value={props.value} onChange={props.onChange} />
        <BoxRow kind="padding" value={props.value} onChange={props.onChange} />
      </div>
    </div>
  );
}

function BoxRow(props: { kind: BoxKind; value: string; onChange: (value: string) => void }) {
  return (
    <div className={`rounded-md border px-1.5 py-1.5 ${props.kind === "margin" ? "border-amber-300/15 bg-amber-300/[0.03]" : props.kind === "border" ? "border-violet-300/15 bg-violet-300/[0.03]" : "border-emerald-300/15 bg-emerald-300/[0.03]"}`}>
      <div className="mb-1 text-[8px] font-medium capitalize tracking-wide text-zinc-500">{props.kind}</div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map((side) => (
          <BoxValueField
            key={side}
            kind={props.kind}
            side={side}
            value={readBoxValue(props.value, props.kind, side)}
            onChange={(value) => props.onChange(setBoxValue(props.value, props.kind, side, value))}
          />
        ))}
      </div>
    </div>
  );
}

function BoxValueField(props: { kind: BoxKind; side: BoxSide; value: string; onChange: (value: string) => void }) {
  return (
    <TextField value={props.value} onChange={props.onChange}>
      <Label className="sr-only">{props.kind} {props.side}</Label>
      <Input
        aria-label={`${props.kind} ${props.side}`}
        className="h-7 w-full rounded border border-white/[0.07] bg-black/25 px-1 text-center font-mono text-[9px] text-zinc-300 outline-none focus:border-sky-300/40"
        placeholder={props.side[0]!.toUpperCase()}
      />
    </TextField>
  );
}

export function readBoxValue(className: string, kind: BoxKind, side: BoxSide): string {
  const tokens = className.split(/\s+/).filter((token) => token && !hasVariant(token));
  const candidates = boxCandidates(kind, side);
  for (const candidate of candidates) {
    const token = [...tokens].reverse().find((utility) => candidate.pattern.test(utility));
    if (token) return displayBoxValue(token, candidate.utilityPrefix);
  }
  return "";
}

export function setBoxValue(className: string, kind: BoxKind, side: BoxSide, rawValue: string): string {
  const sidePrefix = `${prefix[kind]}${kind === "border" ? `-${sideSuffix[side]}` : sideSuffix[side]}`;
  const next = boxUtility(sidePrefix, rawValue, kind);
  const sidePattern = kind === "border"
    ? borderWidthPattern(sideSuffix[side])
    : new RegExp(`^${sidePrefix}-.+$`);
  return replaceTailwindUtilityGroup(className, [], next, (utility) => sidePattern.test(utility));
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
    { pattern: new RegExp(`^${base}${sideSuffix[side]}-.+$`), utilityPrefix: `${base}${sideSuffix[side]}` },
    { pattern: new RegExp(`^${base}${axis}-.+$`), utilityPrefix: `${base}${axis}` },
    { pattern: new RegExp(`^${base}-.+$`), utilityPrefix: base },
  ];
}

function borderWidthPattern(side: string): RegExp {
  return new RegExp(`^border-${side}(?:-(?:0|2|4|8|\\[(?:-?\\d+(?:\\.\\d+)?(?:px|rem|em|%)?|var\\(.+\\))\\]))?$`);
}

function displayBoxValue(token: string, utilityPrefix: string): string {
  if (token === utilityPrefix || token === "border") return "1px";
  const suffix = token.slice(utilityPrefix.length + 1);
  const arbitrary = suffix.match(/^\[(.+)\]$/)?.[1];
  if (arbitrary) return arbitrary.replace(/_/g, " ");
  if (utilityPrefix.startsWith("border")) return `${suffix}px`;
  return scalePixels[suffix] ?? suffix;
}

function boxUtility(utilityPrefix: string, rawValue: string, kind: BoxKind): string {
  const value = rawValue.trim();
  if (!value) return "";
  if (kind === "border" && value === "1px") return utilityPrefix;
  if (value === "auto" && kind !== "border") return `${utilityPrefix}-auto`;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return `${utilityPrefix}-[${value}px]`;
  const scale = Object.entries(scalePixels).find(([, pixels]) => pixels === value)?.[0];
  if (scale && kind !== "border") return `${utilityPrefix}-${scale}`;
  return `${utilityPrefix}-[${value.replace(/\s+/g, "_")}]`;
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
