import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { FileEvidencePanel as ComponentUnderDesign } from "./SourceWorkspaceDetails";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    editable: false,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
