import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { EmptyDocumentRoot as ComponentUnderDesign } from "./EmptyDocumentRoot";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    documentKind: "component",
    onInsert: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
