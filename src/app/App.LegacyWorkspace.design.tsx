
import { defineComponentDesign } from "../shared/component-design";
import { LegacyWorkspace as ComponentUnderDesign } from "./App";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <ComponentUnderDesign />,
});
