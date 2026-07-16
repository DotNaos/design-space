import { Button } from "@heroui/react";
import { CornerUpRight, Monitor, Smartphone, Tablet } from "lucide-react";

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
    <nav aria-label="Source implementation" className="flex h-9 shrink-0 items-stretch justify-center border-b border-white/[0.07] bg-[#101113] px-2">
      {designSpaceDevices.map((device) => (
        <DeviceTab
          key={device}
          active={props.device === device}
          device={device}
          implementation={props.node!.implementations[device]}
          onPress={() => props.onChange(device)}
        />
      ))}
    </nav>
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
      : undefined;
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      aria-label={`${deviceLabels[props.device]} implementation${status ? `, ${status}` : ""}`}
      className={`relative min-h-0 min-w-24 gap-1.5 rounded-none px-3 text-[10px] transition-colors ${props.active ? "text-sky-200 after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-sky-400" : "text-zinc-500 hover:bg-white/[0.025] hover:text-zinc-300"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <span className="relative grid size-3.5 shrink-0 place-items-center">
        <DeviceIcon aria-hidden="true" className={props.implementation.state === "missing" ? "text-zinc-700" : props.implementation.state === "fallback" ? "text-amber-300" : undefined} size={12} />
        {props.implementation.state === "fallback" && <CornerUpRight aria-hidden="true" className="absolute -right-1 -top-1" size={6} />}
        {props.implementation.state === "missing" && <span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" />}
      </span>
      <span>{deviceLabels[props.device]}</span>
      {status && <span className={`hidden text-[8px] xl:inline ${props.implementation.state === "fallback" ? "text-amber-300/80" : "text-zinc-700"}`}>{status}</span>}
    </Button>
  );
}
