import { defineComponentDesign } from "../../../../../../src/shared/component-design";

import { App } from "./App";

export default defineComponentDesign(App, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <App />,
});
