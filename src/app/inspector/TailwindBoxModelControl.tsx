import { Magnet } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";

import { BoxModelUnitTabs } from "./BoxModelUnitTabs";
import { BoxModelValueRows } from "./TailwindBoxModelValueRows";
import { BoxModelDiagram, type BoxFocus } from "./TailwindBoxModelDiagram";
import type { BoxUnit } from "./tailwind-box-model-values";

export { readBoxSource, readBoxValue, setBoxUniformValue, setBoxValue, snapBoxPixels } from "./tailwind-box-model-values";

const detentFlashMs = 130;

export function TailwindBoxModelControl(props: {
  value: string;
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const [hovered, setHovered] = useState<BoxFocus>();
  const [dragged, setDragged] = useState<BoxFocus>();
  const [edited, setEdited] = useState<BoxFocus>();
  const [isDetent, setIsDetent] = useState(false);
  const [unit, setUnit] = useState<BoxUnit>("tailwind");
  const [interactionValue, setInteractionValue] = useState<string>();
  const detentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const interactionValueRef = useRef<string | undefined>(undefined);
  const onPreviewChangeRef = useRef(props.onPreviewChange);
  onPreviewChangeRef.current = props.onPreviewChange;
  const focus = edited ?? dragged ?? hovered;
  const value = interactionValue ?? props.value;

  useEffect(() => () => {
    clearTimeout(detentTimer.current);
    onPreviewChangeRef.current?.();
  }, []);

  const previewInteraction = (next: string) => {
    interactionValueRef.current = next;
    setInteractionValue(next);
    startTransition(() => props.onPreviewChange?.(next));
  };

  const commitInteraction = (next?: string) => {
    const finalValue = next ?? interactionValueRef.current;
    interactionValueRef.current = undefined;
    setInteractionValue(undefined);
    if (finalValue !== undefined && finalValue !== props.value) props.onChange(finalValue);
    startTransition(() => props.onPreviewChange?.());
  };

  /** Every rung the drag clicks past flashes the band, so the snap is felt as well as seen. */
  const flashDetent = () => {
    setIsDetent(true);
    clearTimeout(detentTimer.current);
    detentTimer.current = setTimeout(() => setIsDetent(false), detentFlashMs);
  };

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
        <span className="shrink-0 text-[9px] font-semibold tracking-[-0.01em] text-zinc-400">Box model</span>
        <BoxModelUnitTabs value={unit} onChange={setUnit} />
      </div>

      <BoxModelDiagram
        dragged={dragged}
        edited={edited}
        focus={focus}
        isDetent={isDetent}
        unit={unit}
        value={value}
        onChange={props.onChange}
        onCloseEditor={() => setEdited(undefined)}
        onDetent={flashDetent}
        onDrag={setDragged}
        onEdit={setEdited}
        onHover={setHovered}
        onInteractionChange={previewInteraction}
        onInteractionEnd={commitInteraction}
      />

      <BoxModelValueRows
        focus={focus}
        unit={unit}
        value={value}
        onBlur={() => setHovered(undefined)}
        onChange={props.onChange}
        onFocus={setHovered}
        onInteractionChange={previewInteraction}
        onInteractionEnd={commitInteraction}
      />

      <div className="mt-1.5 flex items-center justify-end gap-1 px-0.5 text-[8px] font-medium tracking-[-0.01em] text-zinc-600">
        <Magnet aria-hidden="true" size={9} />
        {unit === "tailwind" ? "Tailwind scale · 1 = 0.25 rem = 4 px" : unit === "rem" ? "Fixed root · 1 rem = 16 px" : "Pixels · Tailwind 1 = 4 px"}
      </div>
    </div>
  );
}
