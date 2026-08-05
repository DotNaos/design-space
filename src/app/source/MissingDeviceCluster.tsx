
import { designSpaceDevices } from "../../shared/source-workspace";
import { type SourceTreeNode } from "./source-workspace-tree";
import { implementationLabel } from "./SourceWorkspaceSidebar";
import { MissingDeviceIcon } from "./MissingDeviceIcon";

export function MissingDeviceCluster(props: { implementations: SourceTreeNode["implementations"] }) {
  const missing = designSpaceDevices.filter((device) => ["missing", "fallback"].includes(props.implementations[device].state));
  if (!missing.length) return null;
  return (
    <span aria-label={missing.map((device) => implementationLabel(props.implementations[device])).join("; ")} className="flex shrink-0 items-center gap-0.5 text-zinc-600" role="img">
      {missing.map((device) => <MissingDeviceIcon key={device} device={device} implementation={props.implementations[device]} />)}
    </span>
  );
}
