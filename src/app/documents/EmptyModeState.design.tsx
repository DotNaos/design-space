import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { EmptyModeState as ComponentUnderDesign } from "./EmptyModeState";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    mode: "app",
    canCreate: false,
    onCreate: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
