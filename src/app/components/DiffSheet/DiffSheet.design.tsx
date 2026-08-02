import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { DiffSheet as ComponentUnderDesign } from "./DiffSheet";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    diff: "",
    saving: false,
    onClose: () => undefined,
    onSave: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
