import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { TailwindMappedControls as ComponentUnderDesign } from "./TailwindMappedControls";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    value: "",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
