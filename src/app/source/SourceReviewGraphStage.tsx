
import { SourceReviewGraphModeControl } from "./SourceReviewGraphModeControl";
import { ReviewNode } from "./ReviewNode";
import { PropertyRows } from "./PropertyRows";
import { SlotRows } from "./SlotRows";
import { CaseCarousel } from "./CaseCarousel";

export type SourceReviewGraphLayout = "vertical" | "horizontal" | "focus";

export type SourceReviewGraphProperty = {
  name: string;
  required: boolean;
  type: string;
  value?: string;
};

export type SourceReviewGraphSlot = {
  accepts: readonly string[];
  active: boolean;
  children: readonly string[];
  count: number;
  id: string;
  label: string;
  max?: number;
  min: number;
};

export type SourceReviewGraph = {
  caseNames: readonly string[];
  componentLabel: string;
  isStateful: boolean;
  properties: readonly SourceReviewGraphProperty[];
  selectedCase?: string;
  slots: readonly SourceReviewGraphSlot[];
  onCaseChange?: (caseName: string) => void;
  onSelectSlot?: (slotId: string) => void;
};

export function SourceReviewGraphStage(props: {
  frame?: { height: number; left: number; top: number; width: number };
  graph: SourceReviewGraph;
  layout: SourceReviewGraphLayout;
}) {
  const focus = props.layout === "focus";
  const horizontal = props.layout === "horizontal";
  const frame = props.frame;
  const verticalNodeWidth = frame ? Math.min(544, frame.width) : undefined;
  const sideNodeWidth = frame ? Math.min(208, Math.max(144, frame.left - 20)) : undefined;

  return (
    <section
      aria-label={`${props.graph.componentLabel} review graph`}
      className="pointer-events-none relative size-full"
      data-review-graph-layout={props.layout}
      data-testid="source-review-graph-stage"
    >
      {!focus ? (
        <>
          <ReviewNode
            className={horizontal
              ? "absolute -translate-y-1/2"
              : "absolute -translate-x-1/2"}
            eyebrow="Input"
            label="Properties"
            style={frame ? (horizontal ? {
              left: Math.max(4, frame.left - (sideNodeWidth ?? 0) - 12),
              top: frame.top + frame.height / 2,
              width: sideNodeWidth,
            } : {
              left: frame.left + frame.width / 2,
              top: 4,
              width: verticalNodeWidth,
            }) : undefined}
          >
            <PropertyRows properties={props.graph.properties} />
          </ReviewNode>
          <ReviewNode
            className={horizontal
              ? "absolute -translate-y-1/2"
              : "absolute -translate-x-1/2"}
            eyebrow="Output"
            label="Slots"
            style={frame ? (horizontal ? {
              left: frame.left + frame.width + 12,
              top: frame.top + frame.height / 2,
              width: sideNodeWidth,
            } : {
              left: frame.left + frame.width / 2,
              top: frame.top + frame.height + 12,
              width: verticalNodeWidth,
            }) : undefined}
          >
            <SlotRows graph={props.graph} />
          </ReviewNode>
        </>
      ) : null}
      <CaseCarousel frame={frame} graph={props.graph} vertical={horizontal} />
    </section>
  );
}

export { SourceReviewGraphModeControl } from "./SourceReviewGraphModeControl";
