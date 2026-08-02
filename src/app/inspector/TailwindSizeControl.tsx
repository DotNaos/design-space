import { EditorIconTabs } from "../components/EditorIconTabs/EditorIconTabs";
import { parseTailwindToken, replaceTailwindUtilityGroup } from "./tailwind-utility";

type SizeAxis = "width" | "height";
type SizeMode = "auto" | "css-auto" | "full" | "screen" | "fit" | "min" | "max";

type SizeOption = {
  label: string;
  mode: SizeMode;
  suffix: string;
};

const sizeOptions: readonly SizeOption[] = [
  { label: "Auto", mode: "auto", suffix: "" },
  { label: "CSS auto", mode: "css-auto", suffix: "auto" },
  { label: "Full", mode: "full", suffix: "full" },
  { label: "Screen", mode: "screen", suffix: "screen" },
  { label: "Fit content", mode: "fit", suffix: "fit" },
  { label: "Min content", mode: "min", suffix: "min" },
  { label: "Max content", mode: "max", suffix: "max" },
];

export function TailwindSizeControl(props: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2" data-size-mode-controls>
      <SizeAxisControl axis="width" {...props} />
      <SizeAxisControl axis="height" {...props} />
    </div>
  );
}

function SizeAxisControl(props: { axis: SizeAxis; value: string; onChange: (value: string) => void }) {
  const prefix = props.axis === "width" ? "w" : "h";
  const label = props.axis === "width" ? "Width" : "Height";
  const pattern = props.axis === "width" ? /^w-.+$/ : /^h-.+$/;
  const token = findSizeToken(props.value, pattern);
  const knownValues = sizeOptions.slice(1).map((option) => `${prefix}-${option.suffix}`);
  const selectedMode = token === "" ? "auto" : sizeOptions.find((option) => `${prefix}-${option.suffix}` === token)?.mode;

  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2" data-size-axis={props.axis}>
      <div className="flex items-center gap-1.5 text-[9px] font-medium text-zinc-500">
        <AxisGlyph axis={props.axis} />
        <span>{props.axis === "width" ? "W" : "H"}</span>
      </div>
      <EditorIconTabs
        ariaLabel={`${label} size modes`}
        tabs={sizeOptions.map((option) => ({
          icon: <SizeModeGlyph axis={props.axis} mode={option.mode} />,
          label: `${label}: ${option.label}`,
          value: option.mode,
        }))}
        value={selectedMode}
        onChange={(mode) => {
          const option = sizeOptions.find((candidate) => candidate.mode === mode) ?? sizeOptions[0]!;
          const utility = option.suffix ? `${prefix}-${option.suffix}` : "";
          props.onChange(replaceTailwindUtilityGroup(props.value, knownValues, utility, (candidate) => pattern.test(candidate)));
        }}
      />
      {token && !selectedMode ? (
        <span className="col-start-2 min-w-0 truncate text-[8px] text-amber-300/80">Custom · {token}</span>
      ) : null}
    </div>
  );
}

function findSizeToken(current: string, pattern: RegExp): string {
  for (const token of current.split(/\s+/).filter(Boolean)) {
    const parsed = parseTailwindToken(token);
    if (!parsed.modified && pattern.test(parsed.utility)) return parsed.utility;
  }
  return "";
}

function AxisGlyph(props: { axis: SizeAxis }) {
  return (
    <svg aria-hidden="true" className="size-3 text-zinc-600" fill="none" viewBox="0 0 12 12">
      {props.axis === "width" ? (
        <path d="M1.5 3v6m9-6v6M3.5 6h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
      ) : (
        <path d="M3 1.5h6m-6 9h6M6 3.5v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
      )}
    </svg>
  );
}

function SizeModeGlyph(props: { axis: SizeAxis; mode: SizeMode }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 ${props.axis === "height" ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 18 18"
    >
      <SizeModeGlyphPaths mode={props.mode} />
    </svg>
  );
}

function SizeModeGlyphPaths(props: { mode: SizeMode }) {
  const shared = { stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.35 };
  if (props.mode === "auto") {
    return <path d="M3 9h12" strokeDasharray="1.25 2.25" {...shared} />;
  }
  if (props.mode === "css-auto") {
    return <path d="M3 5v8m12-8v8M6 9h6" {...shared} />;
  }
  if (props.mode === "full") {
    return <path d="M2.5 4.5v9m13-9v9M5 9h8m-6-2L5 9l2 2m4-4 2 2-2 2" {...shared} />;
  }
  if (props.mode === "screen") {
    return <path d="M2.5 4h13v10h-13zM5 9h8" {...shared} />;
  }
  if (props.mode === "fit") {
    return <path d="M2.5 5v8m13-8v8M5 9h3m-2-2 2 2-2 2m7-2h-3m2-2-2 2 2 2" {...shared} />;
  }
  if (props.mode === "min") {
    return <path d="M9 5v8M3.5 9H7m-2-2 2 2-2 2m9.5-2H11m2-2-2 2 2 2" {...shared} />;
  }
  return <path d="M2.5 5v8m13-8v8M9 9H5m2-2-2 2 2 2m2-2h4m-2-2 2 2-2 2" {...shared} />;
}
