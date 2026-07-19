import target from "virtual:design-space-target";

import { defineComponentDesign } from "../shared/component-design";
import { SourceWorkspace } from "./SourceWorkspace";

export default defineComponentDesign(SourceWorkspace, {
  isStateful: false,
  defaults: { nestedPreview: true, target },
  designs: { default: {} },
  render: (props) => <SourceWorkspace {...props} />,
});
