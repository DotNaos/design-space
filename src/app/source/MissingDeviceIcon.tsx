
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { type DesignSpaceDevice } from "../../shared/source-workspace";
import { type SourceImplementation } from "./source-workspace-tree";

export function MissingDeviceIcon(props: { device: DesignSpaceDevice; implementation: SourceImplementation }) {
  const Icon = props.device === "desktop" ? Monitor : props.device === "tablet" ? Tablet : Smartphone;
  return <span className="relative grid size-4 place-items-center"><Icon aria-hidden="true" size={11} /><span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" /></span>;
}
