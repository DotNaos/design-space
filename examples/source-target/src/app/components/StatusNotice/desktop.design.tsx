import { defineComponentDesign } from "../../../../../../src/shared/component-design";

import { StatusNotice } from "./desktop";

export default defineComponentDesign(StatusNotice, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: (props) => <StatusNotice {...props} />,
});
