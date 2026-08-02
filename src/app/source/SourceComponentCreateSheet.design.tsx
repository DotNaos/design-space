import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceComponentCreateSheet as ComponentUnderDesign } from "./SourceComponentCreateSheet";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    open: false,
    busy: false,
    onClose: () => undefined,
    onPrepare: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
