
import { SourceReviewGraphLayout } from "./SourceReviewGraphStage";
import { VerticalReviewGraphIcon } from "./VerticalReviewGraphIcon";
import { HorizontalReviewGraphIcon } from "./HorizontalReviewGraphIcon";
import { FocusedReviewGraphIcon } from "./FocusedReviewGraphIcon";
import { GraphModeButton } from "./GraphModeButton";

export function SourceReviewGraphModeControl(props: {
  layout: SourceReviewGraphLayout;
  onChange: (layout: SourceReviewGraphLayout) => void;
}) {
  return (
    <div aria-label="Review graph layout" className="flex shrink-0 items-center border-l border-white/10 pl-1" role="group">
      <GraphModeButton
        active={props.layout === "vertical"}
        label="Inputs above, outputs below"
        onPress={() => props.onChange("vertical")}
      >
        <VerticalReviewGraphIcon />
      </GraphModeButton>
      <GraphModeButton
        active={props.layout === "horizontal"}
        label="Inputs left, outputs right"
        onPress={() => props.onChange("horizontal")}
      >
        <HorizontalReviewGraphIcon />
      </GraphModeButton>
      <GraphModeButton
        active={props.layout === "focus"}
        label="Focus on the current design"
        onPress={() => props.onChange("focus")}
      >
        <FocusedReviewGraphIcon />
      </GraphModeButton>
    </div>
  );
}
