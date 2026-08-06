import { defineComponentDesign } from "../../../../../../src/shared/component-design";
import { AppTablet } from "./App.tablet";

export default defineComponentDesign(AppTablet, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <AppTablet />,
});
