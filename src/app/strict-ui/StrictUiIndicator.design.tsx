import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { StrictUiIndicator as ComponentUnderDesign } from "./StrictUiIndicator";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    marker: undefined as never,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
