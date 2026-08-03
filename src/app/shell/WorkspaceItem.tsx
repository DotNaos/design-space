import { Description, Dropdown, Label } from "@heroui/react";
import { AppWindow, Check } from "lucide-react";
import { WorkspaceSurface } from "./RunningTargetSwitcher";

export function WorkspaceItem(props: {
  checked: boolean;
  description: string;
  icon: typeof AppWindow;
  id: string;
  label: string;
  tone: WorkspaceSurface;
}) {
  const Icon = props.icon;
  return (
    <Dropdown.Item id={props.id} textValue={props.label}>
      <Icon
        aria-hidden="true"
        className={`size-4 shrink-0 ${props.tone === "library" ? "text-violet-300" : "text-sky-300"}`}
      />
      <div className="min-w-0 flex-1">
        <Label className="truncate">{props.label}</Label>
        <Description>{props.description}</Description>
      </div>
      {props.checked ? <Check aria-hidden="true" className="size-4 text-emerald-400" /> : null}
    </Dropdown.Item>
  );
}
