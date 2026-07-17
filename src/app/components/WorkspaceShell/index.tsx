import { Button } from "@heroui/react";

import type { ComponentSlot, ComponentSlotList, StrictUiProps } from "../../../shared/strict-ui";
import type { DocumentWorkspace } from "../../DocumentWorkspace";
import type { LegacyWorkspace } from "../../App";
import type { SourceWorkspace } from "../../SourceWorkspace";

export interface WorkspaceShellProps extends StrictUiProps {
  slots: {
    status: ComponentSlot<typeof WorkspaceStatus>;
    content: ComponentSlot<typeof SourceWorkspace | typeof DocumentWorkspace | typeof LegacyWorkspace>;
    toolbar?: ComponentSlotList<typeof WorkspaceAction, 0, 2>;
  };
}

export function WorkspaceShell({ slots }: WorkspaceShellProps) {
  return (
    <div className="contents">
      {slots.status}
      {slots.content}
      {slots.toolbar}
    </div>
  );
}

export function WorkspaceStatus() {
  return <div className="sr-only">Design Space workspace status</div>;
}

export function WorkspaceAction() {
  return <Button variant="ghost">Workspace action</Button>;
}
