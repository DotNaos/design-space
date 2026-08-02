import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { Inspector as ComponentUnderDesign } from "./Inspector";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    componentLabel: "",
    editable: false,
    classNameValue: "",
    selection: undefined as never,
    onClassNameChange: () => undefined,
    onSelectSlot: () => undefined,
    onAddToSlot: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
