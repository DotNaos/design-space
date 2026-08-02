import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ComponentPropertyBindings as ComponentUnderDesign } from "./ComponentPropertyBindings";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    document: undefined as never,
    catalogComponents: [],
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
