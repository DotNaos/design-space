
import { type ReactNode } from "react";

export function EmptyState(props: { icon: ReactNode; label: string }) {
  return (
    <div className="grid min-h-48 place-items-center text-center text-zinc-600">
      <div>
        <span className="mx-auto grid size-8 place-items-center">{props.icon}</span>
        <p className="mt-1 text-xs">{props.label}</p>
      </div>
    </div>
  );
}
