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
      isIconOnly
      aria-current={props.active ? "page" : undefined}
      aria-label={`${deviceLabels[props.device]} implementation${status ? `, ${status}` : ""}`}
      className={`relative flex size-6 min-h-0 min-w-6 items-center justify-center rounded p-0 leading-none transition-colors ${props.active ? "bg-white/10 text-sky-200" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <DeviceIcon aria-hidden="true" className={`block ${props.implementation.state === "missing" ? "text-zinc-700" : props.implementation.state === "fallback" ? "text-amber-300" : ""}`} size={13} />
        {(props.implementation.state === "missing" || props.implementation.state === "fallback") && <span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" />}
      </span>
    </Button>
  );
  return status ? (
    <Tooltip delay={350}>
      {button}
      <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{status}</Tooltip.Content>
    </Tooltip>
  ) : button;
}
