import { Diamond } from "lucide-react";

import type { SourceLayerOwner } from "./source-layer-ownership";

export function SourceHoverIdentityHud(props: {
  external: boolean;
  owner: SourceLayerOwner;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-[min(420px,calc(100vw-2rem))] max-w-[min(620px,calc(100vw-2rem))] items-center gap-2 rounded-md border border-fuchsia-400/25 bg-[#17131d]/95 px-2.5 py-1.5 text-[11px] shadow-xl shadow-black/35 backdrop-blur"
      data-testid="canvas-hover-identity-hud"
    >
      <Diamond aria-hidden="true" className="size-3 shrink-0 text-fuchsia-400" strokeWidth={2} />
      <span className="shrink-0 font-semibold text-fuchsia-100">{props.owner.label}</span>
      <span aria-hidden="true" className="text-zinc-600">·</span>
      <span className="min-w-0 truncate font-mono text-[10px] text-zinc-400" title={props.owner.relativePath}>
        {props.owner.relativePath}
      </span>
      {props.external ? (
        <span className="shrink-0 border-l border-white/10 pl-2 text-[9px] font-medium uppercase tracking-[0.08em] text-fuchsia-300/75">
          Double-click to open
        </span>
      ) : null}
    </div>
  );
}
