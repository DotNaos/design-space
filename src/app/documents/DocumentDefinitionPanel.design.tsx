import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentDefinitionPanel as ComponentUnderDesign } from "./DocumentDefinitionPanel";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    document: undefined as never,
    documents: [],
    catalogComponents: [],
    onChange: () => undefined,
    onEditImplementation: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
