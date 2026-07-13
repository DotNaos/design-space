import type { ReactNode } from "react";

export const cardSourceClassName = "rounded-3xl bg-zinc-950 p-8 shadow-2xl border border-zinc-700";

export function Card(props: {
  className?: string;
  header?: readonly ReactNode[];
  body?: readonly ReactNode[];
  footer?: readonly ReactNode[];
}) {
  return (
    <article className={`${props.className ?? cardSourceClassName} min-h-80 text-zinc-100`} data-ui="Card">
      <header className="border-b border-white/10 pb-5" data-ui-slot="header">{props.header}</header>
      <div className="py-6" data-ui-slot="body">{props.body}</div>
      {props.footer && props.footer.length > 0 && (
        <footer className="border-t border-white/10 pt-5" data-ui-slot="footer">{props.footer}</footer>
      )}
    </article>
  );
}
