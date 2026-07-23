import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceShell, WorkspaceStatus } from ".";

export default defineComponentDesign(WorkspaceShell, {
  isStateful: false,
  defaults: {
    slots: {
      status: <WorkspaceStatus />,
      content: undefined as never,
    },
  },
  designs: { default: {} },
  render: (props) => <WorkspaceShell {...props} />,
});
