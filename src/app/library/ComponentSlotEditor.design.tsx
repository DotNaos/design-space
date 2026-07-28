import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ComponentSlotEditor as ComponentUnderDesign } from "./ComponentSlotEditor";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    slot: undefined as never,
    catalogComponents: [],
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
