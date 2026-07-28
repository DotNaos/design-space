import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { MobileNavigation as ComponentUnderDesign } from "./MobileNavigation";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    active: "tree",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
