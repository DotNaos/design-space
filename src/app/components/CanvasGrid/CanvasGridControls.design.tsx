import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { CanvasGridControls as ComponentUnderDesign } from "./CanvasGridControls";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    gridVisible: false,
    layoutGrid: undefined as never,
    mode: "dots",
    onGridVisibleChange: () => undefined,
    onLayoutGridChange: () => undefined,
    onModeChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
