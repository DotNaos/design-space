import { Button } from "@heroui/react";
import { Boxes, Plus, Smartphone } from "lucide-react";

import type { ProductMode } from "./DocumentNavigator";

export function EmptyModeState(props: {
  className?: string;
  mode: ProductMode;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const componentMode = props.mode === "library";
  const Icon = componentMode ? Boxes : Smartphone;
  const label = componentMode ? "component" : "screen";
  return (
    <main className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-1 items-center justify-center bg-[#0d0e10] p-8 text-center`}>
      <div className="max-w-sm">
        <Icon aria-hidden="true" className="mx-auto text-zinc-700" size={24} />
        <p className="mt-3 text-sm font-medium text-zinc-200">No {label}s yet</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Create the first {label} from a target-owned starting structure.</p>
        {props.canCreate && <Button className="mt-4" size="sm" onPress={props.onCreate}><Plus size={14} />Create {label}</Button>}
      </div>
    </main>
  );
}
