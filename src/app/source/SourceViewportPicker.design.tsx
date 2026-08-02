import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceViewportPicker as ComponentUnderDesign } from "./SourceViewportPicker";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    device: "desktop",
    presetId: "",
    responsiveWidth: 0,
    onDeviceChange: () => undefined,
    onPresetChange: () => undefined,
    onResponsiveWidthChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
