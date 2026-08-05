
import { Link2, MoveHorizontal, MoveVertical } from "lucide-react";
import { axisSides, readBoxAxis, readBoxValue, setBoxAxisValue, setBoxUniformValue, setBoxValue, type BoxKind, type BoxUnit } from "./tailwind-box-model-values";
import type { BoxFocus } from "./TailwindBoxModelDiagram";
import { BoxFieldMode, sideSuffix, sides, steppedPixels } from "./TailwindBoxModelValueRows";
import { BoxValueField } from "./BoxValueField";

export function BoxValueFields(props: {
  accent: string;
  allowArbitrary: boolean;
  kind: BoxKind;
  mode: BoxFieldMode;
  unit: BoxUnit;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: (focus: BoxFocus) => void;
  value: string;
}) {
  if (props.mode === "sides") {
    return (
      <div className="grid min-w-0 grid-cols-4 gap-1.5">
        {sides.map((side) => (
          <BoxValueField
            accent={props.accent}
            allowArbitrary={props.allowArbitrary}
            hint={sideSuffix[side]}
            key={side}
            kind={props.kind}
            unit={props.unit}
            label={`${props.kind} ${side}`}
            value={readBoxValue(props.value, props.kind, side)}
            onBlur={props.onBlur}
            onChange={(next) => props.onChange(setBoxValue(props.value, props.kind, side, next))}
            onFocus={() => props.onFocus({ kind: props.kind, side })}
            onStep={(direction) => props.onChange(setBoxValue(
              props.value,
              props.kind,
              side,
              `${steppedPixels(props.kind, readBoxValue(props.value, props.kind, side), direction)}px`,
            ))}
          />
        ))}
      </div>
    );
  }

  if (props.mode === "axis") {
    return (
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        {(["x", "y"] as const).map((axis) => (
          <BoxValueField
            accent={props.accent}
            allowArbitrary={props.allowArbitrary}
            icon={axis === "x" ? MoveHorizontal : MoveVertical}
            key={axis}
            kind={props.kind}
            unit={props.unit}
            label={`${props.kind} ${axis === "x" ? "horizontal" : "vertical"}`}
            value={readBoxAxis(props.value, props.kind, axis) ?? ""}
            onBlur={props.onBlur}
            onChange={(next) => props.onChange(setBoxAxisValue(props.value, props.kind, axis, next))}
            onFocus={() => props.onFocus({ kind: props.kind, side: axisSides[axis][0]! })}
            onStep={(direction) => props.onChange(setBoxAxisValue(
              props.value,
              props.kind,
              axis,
              `${steppedPixels(props.kind, readBoxAxis(props.value, props.kind, axis) ?? "", direction)}px`,
            ))}
          />
        ))}
      </div>
    );
  }

  return (
    <BoxValueField
      accent={props.accent}
      allowArbitrary={props.allowArbitrary}
      icon={Link2}
      kind={props.kind}
      unit={props.unit}
      label={`${props.kind} all sides`}
      value={readBoxValue(props.value, props.kind, "top")}
      onBlur={props.onBlur}
      onChange={(next) => props.onChange(setBoxUniformValue(props.value, props.kind, next))}
      onFocus={() => props.onFocus({ kind: props.kind, side: "all" })}
      onStep={(direction) => props.onChange(setBoxUniformValue(
        props.value,
        props.kind,
        `${steppedPixels(props.kind, readBoxValue(props.value, props.kind, "top"), direction)}px`,
      ))}
    />
  );
}
