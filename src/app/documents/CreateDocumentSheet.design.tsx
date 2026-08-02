import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { CreateDocumentSheet as ComponentUnderDesign } from "./CreateDocumentSheet";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    open: false,
    mode: "app",
    recipes: [],
    busy: false,
    onClose: () => undefined,
    onPrepare: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
