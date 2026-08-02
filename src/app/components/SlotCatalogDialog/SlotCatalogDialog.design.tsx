import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { SlotCatalogDialog as ComponentUnderDesign } from "./SlotCatalogDialog";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    open: false,
    slotLabel: "",
    entries: [],
    onClose: () => undefined,
    onSelect: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
