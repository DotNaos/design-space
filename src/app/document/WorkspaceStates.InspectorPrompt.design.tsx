import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { InspectorPrompt as ComponentUnderDesign } from "./WorkspaceStates";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    onEdit: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
