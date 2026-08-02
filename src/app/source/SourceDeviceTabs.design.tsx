import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceDeviceTabs as ComponentUnderDesign } from "./SourceDeviceTabs";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    device: "desktop",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
