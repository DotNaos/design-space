import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { RunningTargetSwitcher as ComponentUnderDesign } from "./RunningTargetSwitcher";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    targetLabel: "",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
