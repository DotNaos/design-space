
import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceAction as ComponentUnderDesign } from "./index";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <ComponentUnderDesign />,
});
