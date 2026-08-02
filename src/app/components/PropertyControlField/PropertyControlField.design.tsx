import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { PropertyControlField as ComponentUnderDesign } from "./PropertyControlField";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    control: [],
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
