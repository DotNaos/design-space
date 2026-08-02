import { defineComponentDesign } from "../../../../../../src/shared/component-design";

import { ToolbarAction } from "./desktop";

export default defineComponentDesign(ToolbarAction, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: (props) => <ToolbarAction {...props} />,
});
