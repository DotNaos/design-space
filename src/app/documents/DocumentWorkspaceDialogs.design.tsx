import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentWorkspaceDialogs as ComponentUnderDesign } from "./DocumentWorkspaceDialogs";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    workspace: undefined as never,
    actions: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
