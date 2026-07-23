import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceWorkspaceSidebar as ComponentUnderDesign } from "./SourceWorkspaceSidebar";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    workspace: undefined as never,
    onSelect: () => undefined,
    onFocus: () => undefined,
    onApplySlot: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
