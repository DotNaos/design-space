import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceWorkspacePageNavigation as ComponentUnderDesign } from "./SourceWorkspacePageNavigation";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    mode: "design",
    onChange: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: {
    default: {},
    preview: { mode: "preview" },
  },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
