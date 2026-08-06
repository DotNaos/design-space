import { Button, Tooltip } from "@heroui/react";
import { Link2, Monitor, Smartphone, Tablet } from "lucide-react";
import { type DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourceImplementation } from "./source-workspace-tree";
import { deviceLabels } from "./SourceDeviceTabs";

export function DeviceTab(props: {
  active: boolean;
  compact?: boolean;
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
        : props.implementation.state === "shared"
          ? "Shared implementation"
      : undefined;
  const button = (
    <Button
      isIconOnly
      aria-current={props.active ? "page" : undefined}
      aria-label={`${deviceLabels[props.device]} implementation${status ? `, ${status}` : ""}`}
      className={`relative flex min-h-0 items-center justify-center rounded-md p-0 leading-none transition-colors ${props.compact ? "size-6 min-w-6" : "size-7 min-w-7"} ${props.active ? "bg-sky-400/15 text-sky-200" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <DeviceIcon aria-hidden="true" className={`block ${props.implementation.state === "missing" ? "text-zinc-700" : props.implementation.state === "fallback" ? "text-amber-300" : ""}`} size={15} />
        {(props.implementation.state === "missing" || props.implementation.state === "fallback") && <span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" />}
        {props.implementation.state === "shared" && <Link2 aria-hidden="true" className="absolute -bottom-1 -right-1 text-sky-300" size={8} />}
      </span>
    </Button>
  );
  return status ? (
    <Tooltip delay={350}>
      {button}
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{status}</Tooltip.Content>
    </Tooltip>
  ) : button;
}
