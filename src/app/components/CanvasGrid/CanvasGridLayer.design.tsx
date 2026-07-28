import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { CanvasGridLayer as ComponentUnderDesign } from "./CanvasGridLayer";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    grid: undefined as never,
    layoutGrid: undefined as never,
    mode: "dots",
    scale: 0,
    visible: false,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
