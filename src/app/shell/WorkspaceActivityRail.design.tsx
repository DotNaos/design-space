import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { WorkspaceActivityRail as ComponentUnderDesign } from "./WorkspaceActivityRail";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    active: "files",
    strictUiChecking: false,
    canStrictUi: false,
    onApp: () => undefined,
    onLibrary: () => undefined,
    onFiles: () => undefined,
    onStrictUi: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
