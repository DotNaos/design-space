import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { StrictUiSheet as ComponentUnderDesign } from "./StrictUiSheet";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    open: false,
    liveViolations: [],
    checking: false,
    onClose: () => undefined,
    onSelect: () => undefined,
    onRecheck: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
