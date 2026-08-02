import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { MobileDock as ComponentUnderDesign } from "./MobileDock";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    active: "canvas",
    page: "design",
    onChange: () => undefined,
    onPageChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
