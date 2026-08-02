import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { CanvasViewportControls as ComponentUnderDesign } from "./CanvasViewportControls";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    gridMode: "dots",
    gridVisible: false,
    interactionMode: "select",
    layoutGrid: undefined as never,
    scale: 0,
    onFit: () => undefined,
    onGridModeChange: () => undefined,
    onGridVisibleChange: () => undefined,
    onLayoutGridChange: () => undefined,
    onReset: () => undefined,
    onZoomIn: () => undefined,
    onZoomOut: () => undefined,
    onToggleInteractionMode: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
