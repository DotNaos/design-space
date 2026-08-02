import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { ItemEditorTools as ComponentUnderDesign } from "./ItemEditorTools";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    mode: "desktop",
    controls: [],
    values: undefined as never,
    onControlChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
