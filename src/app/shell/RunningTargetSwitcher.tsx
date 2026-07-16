import { Button, Description, Dropdown, Label } from "@heroui/react";
import { AppWindow, Check, ChevronDown } from "lucide-react";

import { useRunningTargets } from "../use-running-targets";

export function RunningTargetSwitcher(props: { targetLabel: string }) {
  const targets = useRunningTargets();
  const current = targets.find((target) => target.current);
  const label = current?.project.label ?? props.targetLabel;
  return (
    <Dropdown>
      <Button
        aria-label={`Current app: ${label}. Switch app`}
        className="h-8 min-w-0 max-w-full gap-1.5 rounded-lg px-2 text-sm font-semibold tracking-tight text-zinc-100"
        size="sm"
        variant="ghost"
      >
        <AppWindow aria-hidden="true" className="shrink-0 text-sky-300" size={14} />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-zinc-600" size={12} />
      </Button>
      <Dropdown.Popover className="min-w-64">
        <Dropdown.Menu
          aria-label="Running Design Space apps"
          onAction={(key) => {
            const target = targets.find((candidate) => candidate.instanceId === String(key));
            if (target && !target.current) window.location.assign(target.url);
          }}
        >
          {targets.map((target) => (
            <Dropdown.Item id={target.instanceId} key={target.instanceId} textValue={target.project.label}>
              <AppWindow aria-hidden="true" className="size-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <Label className="truncate">{target.project.label}</Label>
                <Description>{target.current ? "Current app" : "Running locally"}</Description>
              </div>
              {target.current && <Check aria-hidden="true" className="size-4 text-emerald-400" />}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
