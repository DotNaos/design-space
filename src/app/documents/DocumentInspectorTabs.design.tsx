import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentInspectorTabs as ComponentUnderDesign } from "./DocumentInspectorTabs";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    source: "",
    sourceLabel: "",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
