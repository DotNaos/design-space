import { Button } from "@heroui/react";
import { Code2, MessageSquarePlus, X } from "lucide-react";

import type { SourceCodeSelectionContext } from "./source-feedback";

export function SourceCodeContextChip(props: {
  annotation?: boolean;
  label: string;
  onRemove?: () => void;
}) {
  const Icon = props.annotation ? MessageSquarePlus : Code2;
  return (
    <span className="flex h-5 shrink-0 items-center gap-1 rounded-full bg-violet-400/[0.12] pl-2 pr-0.5 text-[8px] font-medium text-violet-200">
      <Icon aria-hidden="true" size={9} />
      <span>{props.annotation ? "Comment · " : ""}{props.label}</span>
      {props.onRemove ? (
        <Button
          isIconOnly
          aria-label={`Remove ${props.label}`}
          className="size-4 min-w-4 rounded-full text-violet-300/70 hover:bg-white/10 hover:text-white"
          size="sm"
          variant="ghost"
          onPress={props.onRemove}
        >
          <X aria-hidden="true" size={9} />
        </Button>
      ) : null}
    </span>
  );
}

export function codeSelectionLabel(selection: SourceCodeSelectionContext) {
  const file = selection.relativePath.split("/").at(-1) ?? selection.relativePath;
  return selection.startLine === selection.endLine
    ? `${file}:${selection.startLine}`
    : `${file}:${selection.startLine}–${selection.endLine}`;
}
