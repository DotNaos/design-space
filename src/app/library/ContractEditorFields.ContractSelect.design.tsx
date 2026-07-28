import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ContractSelect as ComponentUnderDesign } from "./ContractEditorFields";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    label: "Example",
    value: "",
    options: [],
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
