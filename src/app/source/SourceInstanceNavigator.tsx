import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SourceInstanceNavigator(props: {
  count: number;
  index: number;
  onChange: (index: number) => void;
}) {
  const index = Math.min(Math.max(0, props.index), props.count - 1);
  return (
    <div
      className="pointer-events-auto flex items-center gap-1 rounded-full border border-violet-400/25 bg-[#17131d]/95 p-1 text-[10px] text-violet-100 shadow-xl backdrop-blur"
      data-design-space-canvas-action
      data-testid="source-instance-navigator"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button
        isIconOnly
        aria-label="Previous instance"
        className="size-7 min-w-7 rounded-full text-violet-300"
        isDisabled={index === 0}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange(index - 1)}
      >
        <ChevronLeft aria-hidden="true" size={13} />
      </Button>
      <span className="min-w-20 px-1 text-center tabular-nums">
        Instance {index + 1} / {props.count}
      </span>
      <Button
        isIconOnly
        aria-label="Next instance"
        className="size-7 min-w-7 rounded-full text-violet-300"
        isDisabled={index === props.count - 1}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange(index + 1)}
      >
        <ChevronRight aria-hidden="true" size={13} />
      </Button>
    </div>
  );
}
