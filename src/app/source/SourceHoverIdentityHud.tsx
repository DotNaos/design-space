import { Button } from "@heroui/react";
import { ArrowRight, Diamond } from "lucide-react";

import type { SourceLayerOwner } from "./source-layer-ownership";

export function SourceHoverIdentityHud(props: {
  action?: { label: string; onPress: () => void };
  external: boolean;
  owner: SourceLayerOwner;
}) {
  return (
    <div
      aria-hidden={props.action ? undefined : true}
      className="flex h-8 w-full min-w-0 items-center gap-2 rounded-b-md border border-t-0 border-fuchsia-400/25 bg-[#17131d]/95 px-2.5 text-[11px] backdrop-blur"
      data-testid="canvas-selection-identity-footer"
    >
      <Diamond aria-hidden="true" className="size-3 shrink-0 text-fuchsia-400" strokeWidth={2} />
      <span className="shrink-0 font-semibold text-fuchsia-100">{props.owner.label}</span>
      <span aria-hidden="true" className="text-zinc-600">·</span>
      <span className="min-w-0 truncate font-mono text-[10px] text-zinc-400" title={props.owner.relativePath}>
        {props.owner.relativePath}
      </span>
      {props.action ? (
        <Button
          className="ml-auto h-6 min-h-0 shrink-0 gap-1 rounded-md px-2 text-[10px] text-fuchsia-100"
          size="sm"
          variant="secondary"
          onPress={props.action.onPress}
        >
          Open {props.action.label}
          <ArrowRight aria-hidden="true" size={11} />
        </Button>
      ) : props.external ? (
        <span className="shrink-0 border-l border-white/10 pl-2 text-[9px] font-medium text-fuchsia-300/75">
          Double-click to open
        </span>
      ) : null}
    </div>
  );
}
