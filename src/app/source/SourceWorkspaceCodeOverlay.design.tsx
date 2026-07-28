import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceWorkspaceCodeOverlay as ComponentUnderDesign } from "./SourceWorkspaceCodeOverlay";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    open: false,
    onOpenChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
