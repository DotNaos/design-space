import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceWorkspaceTree as ComponentUnderDesign } from "./SourceWorkspaceSidebar";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    onFocus: () => undefined,
    onSelect: () => undefined,
    workspace: target.sourceWorkspace,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
