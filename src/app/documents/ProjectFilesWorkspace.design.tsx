import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ProjectFilesWorkspace as ComponentUnderDesign } from "./ProjectFilesWorkspace";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    files: [],
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
