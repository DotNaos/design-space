import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../../shared/component-design";
import { SourceWorkspace } from "../../SourceWorkspace";
import { WorkspaceShell, WorkspaceStatus } from ".";

export default defineComponentDesign(WorkspaceShell, {
  isStateful: false,
  defaults: {
    slots: {
      status: <WorkspaceStatus />,
      content: <SourceWorkspace nestedPreview target={target} />,
    },
  },
  designs: { default: {} },
  render: (props) => <WorkspaceShell {...props} />,
});
