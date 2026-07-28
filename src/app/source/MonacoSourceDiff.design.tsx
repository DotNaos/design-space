import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { MonacoSourceDiff as ComponentUnderDesign } from "./MonacoSourceDiff";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    modified: "",
    original: "",
    path: "",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
