import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ContractTextInput as ComponentUnderDesign } from "./ContractEditorFields";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    label: "Example",
    value: "",
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
