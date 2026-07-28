import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../shared/component-design";
import { DocumentWorkspace as ComponentUnderDesign } from "./DocumentWorkspace";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    target: target,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
