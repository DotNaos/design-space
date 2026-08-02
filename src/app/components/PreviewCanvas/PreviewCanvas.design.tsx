import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { PreviewCanvas as ComponentUnderDesign } from "./PreviewCanvas";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    rootInstanceId: "",
    selectedComponentInstanceId: "",
    selectionLabel: "",
    onSelect: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
