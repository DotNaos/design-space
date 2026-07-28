import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { RenderedDiff as ComponentUnderDesign } from "./RenderedDiff";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    diff: "",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
