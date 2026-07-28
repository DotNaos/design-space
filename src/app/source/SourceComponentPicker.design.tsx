import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceComponentPicker as ComponentUnderDesign } from "./SourceComponentPicker";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    candidates: [],
    slot: undefined as never,
    onApply: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
