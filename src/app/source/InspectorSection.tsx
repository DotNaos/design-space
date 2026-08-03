
import { Move } from "lucide-react";

export function InspectorSection(props: { children: React.ReactNode; icon: typeof Move; title: string }) {
  const Icon = props.icon;
  return (
    <section className="px-4 py-3">
      <h4 className="mb-2 flex items-center gap-2 text-[10px] font-medium text-zinc-300">
        <span className="grid size-4 shrink-0 place-items-center text-zinc-600">
          <Icon aria-hidden="true" size={12} />
        </span>
        {props.title}
      </h4>
      {props.children}
    </section>
  );
}
