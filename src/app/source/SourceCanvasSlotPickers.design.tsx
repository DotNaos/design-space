import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceCanvasSlotPickers as ComponentUnderDesign } from "./SourceCanvasSlotPickers";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    candidatesForSlot: () => undefined,
    frame: null,
    isBusy: false,
    revision: 0,
    onApply: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
