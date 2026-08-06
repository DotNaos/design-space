

import { designSpaceDevices, type DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourceTreeNode } from "./source-workspace-tree";
import { DeviceTab } from "./DeviceTab";

export const deviceLabels: Record<DesignSpaceDevice, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export function SourceDeviceTabs(props: {
  compact?: boolean;
  device: DesignSpaceDevice;
  node?: SourceTreeNode;
  devices?: readonly DesignSpaceDevice[];
  onChange: (device: DesignSpaceDevice) => void;
}) {
  if (!props.node) return null;
  return (
    <div
      role="group"
      aria-label="Source implementation"
      className={`flex shrink-0 items-center gap-0.5 rounded-lg ${props.compact ? "h-7 bg-white/[0.035] p-0.5" : "h-8 bg-white/[0.045] p-0.5"}`}
    >
      {(props.devices ?? props.node.availableDevices ?? designSpaceDevices).map((device) => (
        <DeviceTab
          key={device}
          active={props.device === device}
          compact={props.compact}
          device={device}
          implementation={props.node!.implementations[device]}
          onPress={() => props.onChange(device)}
        />
      ))}
    </div>
  );
}
