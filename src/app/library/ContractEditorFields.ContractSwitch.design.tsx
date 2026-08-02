import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ContractSwitch as ComponentUnderDesign } from "./ContractEditorFields";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    label: "Example",
    selected: false,
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
