import { defineComponentDesign } from "../../../../../../src/shared/component-design";
import { AppDesktop } from "./App.desktop";

export default defineComponentDesign(AppDesktop, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <AppDesktop />,
});
