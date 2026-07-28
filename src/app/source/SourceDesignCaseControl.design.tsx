import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceDesignCaseControl as ComponentUnderDesign } from "./SourceDesignCaseControl";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceDesignCaseControl.tsx" && entry.exportName === "SourceDesignCaseControl"),
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
