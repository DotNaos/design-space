import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceCanvasViewport as ComponentUnderDesign } from "./SourceCanvasViewport";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    device: "desktop",
    onDeviceChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
