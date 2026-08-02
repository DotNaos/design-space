import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { BlockedOrLoading as ComponentUnderDesign } from "./WorkspaceStates";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    loading: false,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
