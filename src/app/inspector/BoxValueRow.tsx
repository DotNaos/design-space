import { Button } from "@heroui/react";
import { Frame, Link2 } from "lucide-react";
import { useState } from "react";
import { parseBoxLengthPixels, readBoxValue, setBoxUniformValue, type BoxKind, type BoxUnit } from "./tailwind-box-model-values";
import type { BoxFocus } from "./TailwindBoxModelDiagram";
import { BoxFieldMode, boxHue, coarserOf, collapseToMode, fieldModeDetail, naturalFieldMode, sides, snapRowToTailwind } from "./TailwindBoxModelValueRows";
import { BoxPresetSlider } from "./BoxPresetSlider";
import { BoxValueFields } from "./BoxValueFields";
import { BoxKindIcon } from "./BoxKindIcon";
import { PrecisionIcon } from "./PrecisionIcon";
import { BoxModeButton } from "./BoxModeButton";

export function BoxValueRow(props: {
  focus?: BoxFocus;
  kind: BoxKind;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: (focus: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  unit: BoxUnit;
  value: string;
}) {
  const { kind } = props;
  const [requestedMode, setRequestedMode] = useState<BoxFieldMode>("all");
  const [requestedCustom, setRequestedCustom] = useState(false);
  const mode = coarserOf(requestedMode, naturalFieldMode(props.value, kind));
  const hasArbitraryValue = sides.some((side) => parseBoxLengthPixels(readBoxValue(props.value, kind, side)) === undefined);
  const isCustom = requestedCustom || hasArbitraryValue;
  const isActive = props.focus?.kind === kind;
  const accent = `hsl(${boxHue[kind]} 74% 60%)`;

  const setMode = (next: BoxFieldMode) => {
    setRequestedMode(next);
    if (fieldModeDetail[next] < fieldModeDetail[mode]) {
      props.onChange(collapseToMode(props.value, kind, next));
    }
  };

  const toggleCustom = () => {
    if (isCustom) {
      setRequestedCustom(false);
      if (hasArbitraryValue) props.onChange(snapRowToTailwind(props.value, kind));
      return;
    }
    setRequestedCustom(true);
  };

  return (
    <div className="min-w-0 px-0.5" data-box-value-row={kind}>
      <div className="flex min-h-7 items-center gap-2">
        <BoxKindIcon active={isActive} kind={kind} />
        <span className={`min-w-0 flex-1 text-[10px] font-medium capitalize tracking-[-0.01em] ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>
          {kind}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <BoxModeButton
            icon={Link2}
            isOn={mode === "all"}
            label={mode === "all" ? `All ${kind} sides linked` : `Link ${kind} sides`}
            onPress={() => setMode("all")}
          />
          <BoxModeButton
            icon={Frame}
            isOn={mode === "sides"}
            label={mode === "sides" ? `${kind} sides separated` : `Edit ${kind} sides separately`}
            onPress={() => setMode("sides")}
          />
          <Button
            isIconOnly
            aria-label={isCustom ? `Use Tailwind ${kind} values` : `Use custom ${kind} values`}
            aria-pressed={isCustom}
            className={`ml-0.5 size-7 !min-h-0 !min-w-0 rounded-lg !p-0 transition-colors ${
              isCustom ? "bg-[#2a2c33] text-zinc-100" : "text-zinc-600 hover:bg-[#1d1f24] hover:text-zinc-300"
            }`}
            data-box-custom-toggle={kind}
            size="sm"
            variant="ghost"
            onPress={toggleCustom}
          >
            <PrecisionIcon />
          </Button>
        </div>
      </div>

      <div className="ml-8 mt-1 min-w-0">
        {mode === "all" && !isCustom ? (
          <BoxPresetSlider
            kind={kind}
            unit={props.unit}
            value={readBoxValue(props.value, kind, "top")}
            onChange={(value) => props.onInteractionChange(setBoxUniformValue(props.value, kind, value))}
            onChangeEnd={(value) => props.onInteractionEnd(setBoxUniformValue(props.value, kind, value))}
            onFocus={() => props.onFocus({ kind, side: "all" })}
          />
        ) : (
          <BoxValueFields
            accent={accent}
            allowArbitrary={isCustom}
            kind={kind}
            mode={mode}
            unit={props.unit}
            value={props.value}
            onBlur={props.onBlur}
            onChange={props.onChange}
            onFocus={props.onFocus}
          />
        )}
      </div>
    </div>
  );
}
