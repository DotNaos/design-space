import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ScreenWorkshop as ComponentUnderDesign } from "./ScreenWorkshop";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    document: undefined as never,
    onChange: () => undefined,
    onEditRoot: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
