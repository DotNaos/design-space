import { Button } from "@heroui/react";
import { Grid2X2 } from "lucide-react";

export function SourceDesignControls(props: {
  matrix: boolean;
  matrixAvailable: boolean;
  stale: boolean;
  onMatrixChange: () => void;
}) {
  if (!props.stale && !props.matrixAvailable) return null;
  return (
    <div className="flex min-w-0 items-center gap-1">
      {props.stale ? <span className="hidden text-[9px] text-amber-300 xl:inline">Last valid</span> : null}
      {props.matrixAvailable ? <Button isIconOnly aria-label="Toggle property matrix" aria-pressed={props.matrix} className={`size-6 min-w-6 ${props.matrix ? "bg-sky-400/15 text-sky-300" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={props.onMatrixChange}><Grid2X2 aria-hidden="true" size={12} /></Button> : null}
    </div>
  );
}
