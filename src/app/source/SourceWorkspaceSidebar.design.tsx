import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceWorkspaceSidebar as ComponentUnderDesign } from "./SourceWorkspaceSidebar";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    workspace: target.sourceWorkspace,
    onSelect: () => undefined,
    onFocus: () => undefined,
    onApplySlot: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
