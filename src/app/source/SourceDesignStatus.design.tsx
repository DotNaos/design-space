import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceDesignStatus as ComponentUnderDesign } from "./SourceDesignStatus";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    designPath: "",
    label: "Example",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
