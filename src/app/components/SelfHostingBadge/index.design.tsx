import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { SelfHostingBadge as ComponentUnderDesign } from "./index";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {} as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
