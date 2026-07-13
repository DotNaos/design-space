import type { HTMLAttributes, ReactNode } from "react";

import type { PreviewElementAttributes, PreviewSlotAttributes } from "../../../src/shared/target-module";

export const cardSourceClassName = "rounded-3xl bg-zinc-950 p-8 shadow-2xl border border-zinc-700";

export function Card(props: {
  className?: string;
  header?: readonly ReactNode[];
  body?: readonly ReactNode[];
  footer?: readonly ReactNode[];
  previewAttributes?: PreviewElementAttributes;
  slotAttributes?: Readonly<Record<string, PreviewSlotAttributes>>;
}) {
  return (
    <article {...props.previewAttributes as HTMLAttributes<HTMLElement>} className={`${props.className ?? cardSourceClassName} min-h-80 text-zinc-100`} data-ui="Card">
      <header {...props.slotAttributes?.header} className="border-b border-white/10 pb-5" data-ui-slot="header">{props.header}</header>
      <div {...props.slotAttributes?.body} className="py-6" data-ui-slot="body">{props.body}</div>
      {(props.slotAttributes || props.footer && props.footer.length > 0) && (
        <footer {...props.slotAttributes?.footer} className="min-h-10 border-t border-white/10 pt-5" data-ui-slot="footer">{props.footer}</footer>
      )}
    </article>
  );
}
