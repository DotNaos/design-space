import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { TailwindClassField as ComponentUnderDesign } from "./TailwindClassField";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    value: "",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
