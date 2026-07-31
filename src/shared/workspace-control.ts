export const DESIGN_SPACE_CONTROL_PATH = "/__design-space/control";
export const DESIGN_SPACE_CONTROL_CLI_PATH = "/__design-space/cli";
export const DESIGN_SPACE_CONTROL_EVENT = "design-space:workspace-control";

export type WorkspacePanelControlCommand = {
  type: "workspace-panel";
  side: "left" | "right";
  action: "open" | "close" | "toggle";
  scope: "top";
};

export type WorkspaceComponentControlCommand = {
  type: "workspace-component";
  name: string;
  action: "isolate";
  scope: "top";
};

export type WorkspaceControlCommand = WorkspacePanelControlCommand | WorkspaceComponentControlCommand;

export function parseWorkspaceControlCommand(value: unknown): WorkspaceControlCommand | undefined {
  return parseWorkspacePanelControlCommand(value) ?? parseWorkspaceComponentControlCommand(value);
}

export function parseWorkspacePanelControlCommand(value: unknown): WorkspacePanelControlCommand | undefined {
  if (!value || typeof value !== "object") return undefined;
  const command = value as Partial<WorkspacePanelControlCommand>;
  if (command.type !== "workspace-panel") return undefined;
  if (command.side !== "left" && command.side !== "right") return undefined;
  if (command.action !== "open" && command.action !== "close" && command.action !== "toggle") return undefined;
  if (command.scope !== "top") return undefined;
  return command as WorkspacePanelControlCommand;
}

export function parseWorkspaceComponentControlCommand(value: unknown): WorkspaceComponentControlCommand | undefined {
  if (!value || typeof value !== "object") return undefined;
  const command = value as Partial<WorkspaceComponentControlCommand>;
  if (command.type !== "workspace-component") return undefined;
  if (typeof command.name !== "string" || !command.name.trim() || command.name.length > 160) return undefined;
  if (command.action !== "isolate" || command.scope !== "top") return undefined;
  return { ...command, name: command.name.trim() } as WorkspaceComponentControlCommand;
}
