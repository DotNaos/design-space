import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { DesignDocumentPreview as ComponentUnderDesign } from "./document-runtime";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    target: target,
    document: undefined as never,
    library: [],
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
