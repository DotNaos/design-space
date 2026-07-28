import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SlotInspector as ComponentUnderDesign } from "./SlotInspector";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    slot: undefined as never,
    authoredDefinition: false,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
