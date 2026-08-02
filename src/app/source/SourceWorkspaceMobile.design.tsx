import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceWorkspaceMobile as ComponentUnderDesign } from "./SourceWorkspaceMobile";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    activity: "files",
    mobilePane: "tree",
    onActivityChange: () => undefined,
    onPaneChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
