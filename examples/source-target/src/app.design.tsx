import { defineComponentDesign } from "../../../src/shared/component-design";

import { App } from "./app";

export default defineComponentDesign(App, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <App />,
});
