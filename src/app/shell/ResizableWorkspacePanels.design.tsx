import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ResizableWorkspacePanels as ComponentUnderDesign } from "./ResizableWorkspacePanels";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    namespace: undefined as never,
    left: undefined as never,
    right: undefined as never,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
