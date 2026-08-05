import { Button } from "@heroui/react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { SourceReviewGraph } from "./SourceReviewGraphStage";
import { CaseLabel } from "./CaseLabel";

export function CaseCarousel(props: {
  frame?: { height: number; left: number; top: number; width: number };
  graph: SourceReviewGraph;
  vertical: boolean;
}) {
  const names = props.graph.caseNames;
  const selectedIndex = Math.max(0, names.indexOf(props.graph.selectedCase ?? ""));
  const selected = names[selectedIndex];
  const canCycle = names.length > 1 && Boolean(props.graph.onCaseChange);
  const previous = names[(selectedIndex - 1 + names.length) % names.length];
  const next = names[(selectedIndex + 1) % names.length];
  const cycle = (direction: -1 | 1) => {
    if (!canCycle) return;
    props.graph.onCaseChange?.(names[(selectedIndex + direction + names.length) % names.length]!);
  };
  const PreviousIcon = props.vertical ? ChevronUp : ChevronLeft;
  const NextIcon = props.vertical ? ChevronDown : ChevronRight;

  if (props.vertical) {
    return (
      <div
        className="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-center justify-between"
        data-testid="source-review-case-carousel"
        style={props.frame ? {
          height: props.frame.height + 80,
          left: props.frame.left + props.frame.width / 2,
          top: props.frame.top - 40,
        } : undefined}
      >
        <div className="pointer-events-auto flex items-center rounded-full bg-[#15161a] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.22)]" data-design-space-canvas-chrome>
          <Button isIconOnly aria-label="Previous design case" className="size-7 min-w-7 text-zinc-400" isDisabled={!canCycle} size="sm" variant="ghost" onPress={() => cycle(-1)}>
            <ChevronUp size={13} />
          </Button>
          <CaseLabel count={names.length} index={selectedIndex} selected={selected} />
        </div>
        <Button
          isIconOnly
          aria-label="Next design case"
          className="pointer-events-auto size-8 min-w-8 rounded-full border-0 bg-[#15161a] text-zinc-400 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
          data-design-space-canvas-chrome
          isDisabled={!canCycle}
          size="sm"
          variant="ghost"
          onPress={() => cycle(1)}
        >
          <ChevronDown size={13} />
        </Button>
        {canCycle ? <span className="sr-only">Previous: {previous}. Next: {next}.</span> : null}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute z-10 flex -translate-x-1/2 items-center rounded-full bg-[#15161a] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
      data-design-space-canvas-chrome
      data-testid="source-review-case-carousel"
      style={props.frame ? {
        left: props.frame.left + props.frame.width / 2,
        top: Math.max(4, props.frame.top - 44),
      } : undefined}
    >
      <Button isIconOnly aria-label="Previous design case" className="size-7 min-w-7 text-zinc-400" isDisabled={!canCycle} size="sm" variant="ghost" onPress={() => cycle(-1)}>
        <PreviousIcon size={13} />
      </Button>
      <CaseLabel count={names.length} index={selectedIndex} selected={selected} />
      <Button isIconOnly aria-label="Next design case" className="size-7 min-w-7 text-zinc-400" isDisabled={!canCycle} size="sm" variant="ghost" onPress={() => cycle(1)}>
        <NextIcon size={13} />
      </Button>
      {canCycle ? (
        <span className="sr-only">Previous: {previous}. Next: {next}.</span>
      ) : null}
    </div>
  );
}
