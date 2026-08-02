import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceShell } from ".";

export default defineComponentDesign(WorkspaceShell, {
  isStateful: false,
  preview: {
    background: "#0d0f12",
    height: 640,
    layout: "start",
    padding: 16,
    width: 960,
  },
  defaults: {},
  designs: { default: {} },
  render: (props) => <WorkspaceShell {...props} />,
});
