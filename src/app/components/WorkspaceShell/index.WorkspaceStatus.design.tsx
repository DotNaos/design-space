
import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceStatus as ComponentUnderDesign } from "./index";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <ComponentUnderDesign />,
});
