import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { WorkspaceSidebar as ComponentUnderDesign } from "./WorkspaceSidebar";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    active: "tree",
    canCreate: false,
    entries: [],
    mode: "app",
    projectLabel: "",
    onChange: () => undefined,
    onCreate: () => undefined,
    onDocumentSelect: () => undefined,
    onModeChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
