import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { SlotCatalogPanel as ComponentUnderDesign } from "./SlotCatalogPanel";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    slotLabel: "",
    entries: [],
    onClose: () => undefined,
    onSelect: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
