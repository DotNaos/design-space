import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { type WorkspacePanelWidths } from "./workspace-panel-state";

export function PanelToggleIcon(props: { side: keyof WorkspacePanelWidths; visible: boolean }) {
  const Icon = props.side === "left"
    ? props.visible ? PanelLeftClose : PanelLeftOpen
    : props.visible ? PanelRightClose : PanelRightOpen;
  return <Icon aria-hidden="true" size={14} />;
}
