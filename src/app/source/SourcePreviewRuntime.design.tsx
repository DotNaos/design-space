import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourcePreviewRuntimeContext as ComponentUnderDesign } from "./SourcePreviewRuntime";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    value: false,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
