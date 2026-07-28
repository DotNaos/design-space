import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { CodeDocumentSwitch as ComponentUnderDesign } from "./SourceWorkspaceDetails";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    value: "source",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
