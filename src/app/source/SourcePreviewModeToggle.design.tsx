import { useEffect, useState } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourcePreviewModeToggle, type SourcePreviewModeToggleProps } from "./SourcePreviewModeToggle";

export default defineComponentDesign(SourcePreviewModeToggle, {
  isStateful: true,
  initialState: "design",
  defaults: { mode: "design", onChange: () => undefined },
  states: {
    design: { mode: "design" },
    play: { mode: "play" },
  },
  render: (props) => <InteractivePreview {...props} />,
});

function InteractivePreview(props: SourcePreviewModeToggleProps) {
  const [mode, setMode] = useState(props.mode);
  useEffect(() => setMode(props.mode), [props.mode]);
  return (
    <div className="flex min-h-32 items-center justify-center bg-[#0d0e10] p-6">
      <SourcePreviewModeToggle mode={mode} onChange={setMode} />
    </div>
  );
}
