import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { FileBrowser as ComponentUnderDesign } from "./FileBrowser";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    files: [],
    onSelect: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
