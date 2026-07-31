import { useEffect } from "react";

import {
  DESIGN_SPACE_CONTROL_EVENT,
  parseWorkspacePanelControlCommand,
  type WorkspacePanelControlCommand,
} from "../../shared/workspace-control";

type WorkspacePanelControlActions = {
  setVisible: (side: "left" | "right", visible: boolean) => void;
  toggle: (side: "left" | "right") => void;
};

export function useWorkspacePanelControl(actions: WorkspacePanelControlActions): void {
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const receive = (value: unknown) => {
      const command = parseWorkspacePanelControlCommand(value);
      if (!command || window.top !== window) return;
      applyWorkspacePanelControl(command, actions);
    };
    hot.on(DESIGN_SPACE_CONTROL_EVENT, receive);
    return () => hot.off?.(DESIGN_SPACE_CONTROL_EVENT, receive);
  }, [actions.setVisible, actions.toggle]);
}

export function applyWorkspacePanelControl(
  command: WorkspacePanelControlCommand,
  actions: WorkspacePanelControlActions,
): void {
  if (command.action === "toggle") {
    actions.toggle(command.side);
    return;
  }
  actions.setVisible(command.side, command.action === "open");
}
