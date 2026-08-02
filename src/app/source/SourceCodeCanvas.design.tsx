import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceCodeCanvas as ComponentUnderDesign } from "./SourceCodeCanvas";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    editor: undefined as never,
    editable: false,
    label: "Example",
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
