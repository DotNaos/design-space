import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentWorkspaceSurface as ComponentUnderDesign } from "./DocumentWorkspaceSurface";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    projectId: "",
    documentId: "",
    mobilePane: "tree",
    onMobileDrawerClose: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
