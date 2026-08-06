import { defineComponentDesign } from "../../../../../src/shared/component-design";
import DesktopApp from "./App.desktop";

export default defineComponentDesign(DesktopApp, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <DesktopApp />,
});
