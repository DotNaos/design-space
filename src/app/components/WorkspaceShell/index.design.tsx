import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceShell, WorkspaceStatus } from ".";

function WorkspaceContentSlotTexture() {
  return (
    <main
      aria-label="Empty content slot"
      className="min-h-screen w-full bg-[#0d0e10] [background-image:repeating-linear-gradient(135deg,rgba(148,163,184,0.14)_0,rgba(148,163,184,0.14)_8px,transparent_8px,transparent_22px)]"
      data-design-space-slot-texture="content"
    />
  );
}

export default defineComponentDesign(WorkspaceShell, {
  isStateful: false,
  defaults: {
    slots: {
      status: <WorkspaceStatus />,
      content: <WorkspaceContentSlotTexture />,
    },
  },
  designs: { default: {} },
  render: (props) => <WorkspaceShell {...props} />,
});
