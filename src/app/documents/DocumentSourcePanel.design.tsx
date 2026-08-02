import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentSourcePanel as ComponentUnderDesign } from "./DocumentSourcePanel";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    label: "Example",
    source: "",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
