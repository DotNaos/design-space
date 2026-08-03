import { EditorIconTabs } from "../components/EditorIconTabs/EditorIconTabs";
import { replaceTailwindUtilityGroup } from "./tailwind-utility";
import { SizeAxis, findSizeToken, sizeOptions } from "./TailwindSizeControl";
import { AxisGlyph } from "./AxisGlyph";
import { SizeModeGlyph } from "./SizeModeGlyph";

export function SizeAxisControl(props: { axis: SizeAxis; value: string; onChange: (value: string) => void }) {
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
