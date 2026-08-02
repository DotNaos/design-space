import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ComponentWorkshop as ComponentUnderDesign } from "./ComponentWorkshop";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    document: undefined as never,
    documents: [],
    catalogComponents: [],
    onChange: () => undefined,
    onEditImplementation: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
