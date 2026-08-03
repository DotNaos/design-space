
import { ChevronDown } from "lucide-react";

export function InspectorSection(props: { title: string; open?: boolean; children?: React.ReactNode }) {
  return (
    <section className="border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-300">{props.title}</h3>
        <ChevronDown size={13} className={props.open ? "text-zinc-500" : "-rotate-90 text-zinc-700"} />
      </div>
      {props.open && <div className="mt-3">{props.children}</div>}
    </section>
  );
}
