import { Button } from "@heroui/react";
import { ArrowDown, ArrowUp, LocateFixed } from "lucide-react";

export function centerSourceTreeRow(scroll: HTMLElement, row: HTMLElement) {
  const scrollRect = scroll.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const rowTop = rowRect.top - scrollRect.top + scroll.scrollTop;
  scroll.scrollTop = Math.max(
    0,
    Math.min(
      scroll.scrollHeight - scroll.clientHeight,
      rowTop - (scroll.clientHeight - rowRect.height) / 2,
    ),
  );
}

export function SourceTreeAnchorControls(props: {
  activeDirection?: "above" | "below";
  hasSelection: boolean;
  selectedDirection?: "above" | "below";
  onScrollToActive: () => void;
  onScrollToSelected: () => void;
}) {
  if (!props.activeDirection && !props.hasSelection) return null;
  return (
    <div className="absolute right-3 top-3 z-30 flex gap-1">
      {props.activeDirection ? (
        <Button
          isIconOnly
          aria-label={`Scroll to active component ${props.activeDirection}`}
          className="size-8 min-w-8 rounded-full border border-white bg-white text-black shadow-lg shadow-black/30 hover:bg-zinc-200"
          size="sm"
          variant="secondary"
          onPress={props.onScrollToActive}
        >
          {props.activeDirection === "above"
            ? <ArrowUp aria-hidden="true" size={14} />
            : <ArrowDown aria-hidden="true" size={14} />}
        </Button>
      ) : null}
      {props.hasSelection ? (
        <Button
          isIconOnly
          aria-label="Scroll to current selection"
          className="size-8 min-w-8 rounded-full border border-violet-300/50 bg-violet-500 text-white shadow-lg shadow-black/30 hover:bg-violet-400"
          size="sm"
          variant="secondary"
          onPress={props.onScrollToSelected}
        >
          <LocateFixed aria-hidden="true" size={14} />
        </Button>
      ) : null}
    </div>
  );
}
