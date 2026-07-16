import { Button, Tooltip } from "@heroui/react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import { designSpaceDevices, type DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourceImplementation, SourceTreeNode } from "./source-workspace-tree";

const deviceLabels: Record<DesignSpaceDevice, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export function SourceDeviceTabs(props: {
  device: DesignSpaceDevice;
  node?: SourceTreeNode;
  onChange: (device: DesignSpaceDevice) => void;
}) {
  if (!props.node) return null;
  return (
    <div role="group" aria-label="Source implementation" className="flex h-7 shrink-0 items-center rounded-md bg-black/15 p-0.5">
      {designSpaceDevices.map((device) => (
        <DeviceTab
          key={device}
          active={props.device === device}
          device={device}
          implementation={props.node!.implementations[device]}
          onPress={() => props.onChange(device)}
        />
      ))}
    </div>
  );
}

function DeviceTab(props: {
  active: boolean;
  device: DesignSpaceDevice;
  implementation: SourceImplementation;
  onPress: () => void;
}) {
  const DeviceIcon = props.device === "desktop" ? Monitor : props.device === "tablet" ? Tablet : Smartphone;
  const status = props.implementation.state === "fallback"
    ? `Uses ${props.implementation.sourceDevice ? deviceLabels[props.implementation.sourceDevice] : "fallback"}`
    : props.implementation.state === "missing"
      ? "Missing"
      : props.implementation.state === "responsive"
        ? "Responsive"
      : undefined;
  const button = (
    <Button
      aria-current={props.active ? "page" : undefined}
      aria-label={`${deviceLabels[props.device]} implementation${status ? `, ${status}` : ""}`}
      className={`relative min-h-0 h-6 min-w-0 gap-1 rounded px-1.5 text-[9px] transition-colors ${props.active ? "bg-white/10 text-sky-200" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <span className="relative grid size-3.5 shrink-0 place-items-center">
        <DeviceIcon aria-hidden="true" className={props.implementation.state === "missing" ? "text-zinc-700" : props.implementation.state === "fallback" ? "text-amber-300" : undefined} size={12} />
        {(props.implementation.state === "missing" || props.implementation.state === "fallback") && <span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" />}
      </span>
      <span className="hidden lg:inline">{deviceLabels[props.device]}</span>
    </Button>
  );
  return status ? (
    <Tooltip delay={350}>
      {button}
      <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{status}</Tooltip.Content>
    </Tooltip>
  ) : button;
}
