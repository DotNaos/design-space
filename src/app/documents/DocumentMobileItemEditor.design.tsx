import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentMobileItemEditor as ComponentUnderDesign } from "./DocumentMobileItemEditor";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    itemEditor: () => undefined,
    files: [],
    onEditDefinition: () => undefined,
    onOpenIsolated: () => undefined,
    onSelectSlot: () => undefined,
    onClose: () => undefined,
    onApply: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
