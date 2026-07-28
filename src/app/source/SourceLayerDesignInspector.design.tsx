import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceLayerDesignInspector as ComponentUnderDesign } from "./SourceLayerDesignInspector";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    layer: undefined as never,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
