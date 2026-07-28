import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceChangeReviewModal as ComponentUnderDesign } from "./SourceChangeReviewModal";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    changes: [],
    open: false,
    onApply: () => undefined,
    onClose: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
