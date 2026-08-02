import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { MonacoSourceEditor as ComponentUnderDesign } from "./MonacoSourceEditor";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    path: "",
    readOnly: false,
    value: "",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
