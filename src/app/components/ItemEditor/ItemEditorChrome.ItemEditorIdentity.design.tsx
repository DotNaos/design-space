import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { ItemEditorIdentity as ComponentUnderDesign } from "./ItemEditorChrome";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    componentLabel: "",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
