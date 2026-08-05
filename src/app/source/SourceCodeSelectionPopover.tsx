import { Button, TextArea } from "@heroui/react";
import { MessageSquarePlus, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SourceCodeSelectionContext } from "./source-feedback";

export interface SourceCodePopoverSelection extends SourceCodeSelectionContext {
  anchor: { left: number; top: number };
}

export function SourceCodeSelectionPopover(props: {
  selection: SourceCodePopoverSelection;
  onAnnotate: (comment: string) => void;
  onAttach: () => void;
  onDismiss: () => void;
}) {
  const [comment, setComment] = useState("");
  const popoverRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setComment("");
  }, [props.selection.id]);

  useEffect(() => {
    function dismissOnOutsidePointer(event: PointerEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) props.onDismiss();
    }
    document.addEventListener("pointerdown", dismissOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
  }, [props.onDismiss]);

  const lineLabel = props.selection.startLine === props.selection.endLine
    ? `Line ${props.selection.startLine}`
    : `Lines ${props.selection.startLine}–${props.selection.endLine}`;

  return (
    <form
      ref={popoverRef}
      aria-label="Comment on selected code"
      className="absolute z-30 grid w-[min(300px,calc(100%_-_24px))] gap-2 rounded-2xl bg-[#202126] p-2.5 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
      style={{
        left: props.selection.anchor.left,
        top: Math.max(12, props.selection.anchor.top + 8),
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (comment.trim()) props.onAnnotate(comment.trim());
      }}
    >
      <div className="flex min-w-0 items-center gap-2 px-1">
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-zinc-200">
          {props.selection.relativePath}
        </span>
        <span className="shrink-0 text-[9px] tabular-nums text-zinc-500">{lineLabel}</span>
        <Button
          isIconOnly
          aria-label="Dismiss code selection"
          className="size-6 min-w-6 rounded-full text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-100"
          size="sm"
          variant="ghost"
          onPress={props.onDismiss}
        >
          <X aria-hidden="true" size={12} />
        </Button>
      </div>
      <TextArea
        aria-label="Code annotation comment"
        className="max-h-28 min-h-16 resize-none rounded-xl border-0 bg-[#151619] px-2.5 py-2 text-[11px] leading-4 text-zinc-100 outline-none placeholder:text-zinc-500"
        placeholder="What should change here?"
        rows={2}
        value={comment}
        variant="secondary"
        onChange={(event) => setComment(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            props.onDismiss();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          className="h-7 min-w-0 gap-1.5 rounded-full bg-white/[0.07] px-2.5 text-[9px] text-zinc-200 hover:bg-white/[0.11]"
          size="sm"
          variant="ghost"
          onPress={props.onAttach}
        >
          <Paperclip aria-hidden="true" size={11} />
          Add context
        </Button>
        <Button
          className="h-7 min-w-0 gap-1.5 rounded-full bg-violet-500 px-2.5 text-[9px] font-semibold text-white hover:bg-violet-400"
          isDisabled={!comment.trim()}
          size="sm"
          type="submit"
          variant="primary"
        >
          <MessageSquarePlus aria-hidden="true" size={11} />
          Add annotation
        </Button>
      </div>
    </form>
  );
}
