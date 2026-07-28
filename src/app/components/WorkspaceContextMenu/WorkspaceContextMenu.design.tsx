import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceContextMenu as ComponentUnderDesign } from "./WorkspaceContextMenu";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    menu: undefined as never,
    actions: [],
    onClose: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
