import { ListBox, Select } from "@heroui/react";
import { AppWindow, MonitorSmartphone, Smartphone } from "lucide-react";

import type { SourceWorkspaceTarget } from "../../shared/source-workspace";

export function SourceTargetPicker(props: {
  targetId: string;
  targets: readonly SourceWorkspaceTarget[];
  onChange: (targetId: string) => void;
}) {
  if (props.targets.length < 2) return null;
  const selected = props.targets.find((target) => target.id === props.targetId) ?? props.targets[0];
  const SelectedIcon = targetIcon(selected.runtime);
  return (
    <Select
      aria-label="App target"
      className="w-28 shrink-0"
      selectedKey={selected.id}
      onSelectionChange={(key) => props.onChange(String(key))}
    >
      <Select.Trigger className="flex h-7 min-w-0 items-center gap-1 rounded-lg bg-white/[0.045] px-2 text-zinc-300 outline-none">
        <Select.Value className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <SelectedIcon aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />
          <span className="truncate text-[10px] font-medium">{targetLabel(selected.id)}</span>
        </Select.Value>
        <Select.Indicator className="size-3 shrink-0 text-zinc-600" />
      </Select.Trigger>
      <Select.Popover placement="bottom start" className="min-w-52 rounded-xl bg-[#1a1b1e] p-1.5 shadow-2xl">
        <ListBox items={props.targets} className="flex flex-col gap-0.5">
          {(target) => {
            const Icon = targetIcon(target.runtime);
            return (
              <ListBox.Item id={target.id} textValue={targetLabel(target.id)} className="group flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs text-zinc-300 outline-none data-[focused]:bg-white/[0.07] data-[selected]:bg-white/10 data-[selected]:text-sky-200">
                <Icon aria-hidden="true" className="shrink-0 text-zinc-500" size={14} />
                <span>{targetLabel(target.id)}</span>
                <span className="ml-auto text-[9px] text-zinc-600">{target.runtime}</span>
                <ListBox.ItemIndicator className="size-3" />
              </ListBox.Item>
            );
          }}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function targetLabel(id: string) {
  return id.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function targetIcon(runtime: SourceWorkspaceTarget["runtime"]) {
  if (runtime === "react-native") return Smartphone;
  if (runtime === "electron") return AppWindow;
  return MonitorSmartphone;
}
