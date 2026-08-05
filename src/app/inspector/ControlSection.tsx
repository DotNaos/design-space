
import { type LucideIcon } from "lucide-react";

export function ControlSection(props: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <section className="py-3 first:pt-2">
      <h4 className="mb-2 flex items-center gap-2 text-[10px] font-medium text-zinc-300">
        <span className="grid size-4 shrink-0 place-items-center text-zinc-600">
          <Icon aria-hidden="true" size={12} />
        </span>
        {props.title}
      </h4>
      <div>{props.children}</div>
    </section>
  );
}
