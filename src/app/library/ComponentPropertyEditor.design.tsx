import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ComponentPropertyEditor as ComponentUnderDesign } from "./ComponentPropertyEditor";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    property: undefined as never,
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
