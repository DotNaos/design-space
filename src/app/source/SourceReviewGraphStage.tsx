import { Button, Tooltip } from "@heroui/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Route,
} from "lucide-react";

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

function VerticalReviewGraphIcon() {
  return (
    <svg aria-hidden="true" className="size-4" data-graph-layout-icon="vertical" fill="none" viewBox="0 0 16 16">
      <rect height="2.5" rx="1.25" stroke="currentColor" strokeWidth="1.25" width="8" x="4" y="1" />
      <rect height="5" rx="1.25" stroke="currentColor" strokeWidth="1.25" width="6" x="5" y="5.5" />
      <rect height="2.5" rx="1.25" stroke="currentColor" strokeWidth="1.25" width="8" x="4" y="12.5" />
      <path d="M8 3.5v2M8 10.5v2" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function HorizontalReviewGraphIcon() {
  return (
    <svg aria-hidden="true" className="size-4" data-graph-layout-icon="horizontal" fill="none" viewBox="0 0 16 16">
      <rect height="8" rx="1.25" stroke="currentColor" strokeWidth="1.25" width="2.5" x="1" y="4" />
      <rect height="6" rx="1.25" stroke="currentColor" strokeWidth="1.25" width="5" x="5.5" y="5" />
      <rect height="8" rx="1.25" stroke="currentColor" strokeWidth="1.25" width="2.5" x="12.5" y="4" />
      <path d="M3.5 8h2M10.5 8h2" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function FocusedReviewGraphIcon() {
  return (
    <svg aria-hidden="true" className="size-4" data-graph-layout-icon="focus" fill="none" viewBox="0 0 16 16">
      <rect height="6" rx="1.5" stroke="currentColor" strokeWidth="1.25" width="6" x="5" y="5" />
      <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
    </svg>
  );
}

function ReviewNode(props: {
  children: React.ReactNode;
  className: string;
  eyebrow: string;
  label: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-auto z-10 overflow-hidden rounded-xl bg-[#15161a] shadow-[0_8px_24px_rgba(0,0,0,0.22)] ${props.className}`}
      data-design-space-canvas-chrome
      style={props.style}
    >
      <header className="flex h-7 items-center gap-2 border-b border-white/[0.07] px-2.5">
        <span className="text-[9px] font-medium text-sky-300/75">{props.eyebrow}</span>
        <span className="text-[10px] font-medium text-zinc-200">{props.label}</span>
      </header>
      {props.children}
    </div>
  );
}

function PropertyRows(props: { properties: readonly SourceReviewGraphProperty[] }) {
  if (!props.properties.length) {
    return <p className="px-2.5 py-2 text-[9px] text-zinc-600">No design properties</p>;
  }
  const visible = props.properties.slice(0, 3);
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden p-1.5">
      {visible.map((property) => (
        <span key={property.name} className="min-w-0 max-w-40 truncate rounded-md bg-white/[0.04] px-2 py-1 text-[9px] text-zinc-400">
          <strong className="font-medium text-zinc-200">{property.name}</strong>
          <span className="text-zinc-600"> · </span>
          {property.value ?? property.type}
          {property.required ? <span className="text-amber-300/80"> *</span> : null}
        </span>
      ))}
      {props.properties.length > visible.length ? (
        <span className="shrink-0 px-1 text-[9px] text-zinc-600">+{props.properties.length - visible.length}</span>
      ) : null}
    </div>
  );
}

function SlotRows(props: { graph: SourceReviewGraph }) {
  if (!props.graph.slots.length) {
    return <p className="px-2.5 py-2 text-[9px] text-zinc-600">No outgoing slots</p>;
  }
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {props.graph.slots.map((slot) => {
        const occupancy = slot.count
          ? slot.children.join(", ")
          : "Empty";
        const cardinality = slot.max === undefined ? `${slot.count}+` : `${slot.count}/${slot.max}`;
        return (
          <Button
            key={slot.id}
            aria-label={`Select ${slot.label} slot`}
            aria-pressed={slot.active}
            className={`h-auto min-w-0 shrink-0 flex-col items-stretch gap-0 rounded-lg border-0 px-2 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fuchsia-400 ${slot.active ? "bg-fuchsia-400/14 text-fuchsia-100 ring-1 ring-inset ring-fuchsia-400/45" : "bg-white/[0.035] hover:bg-white/[0.065]"}`}
            data-slot-occupancy={slot.count}
            size="sm"
            variant="ghost"
            onPress={() => props.graph.onSelectSlot?.(slot.id)}
          >
            <span className="flex items-center gap-1 text-[9px] font-medium text-zinc-200">
              {slot.label}
              <span className="font-mono text-[8px] text-zinc-600">{cardinality}</span>
            </span>
            <span className={`block max-w-36 truncate text-[8px] ${slot.count ? "text-violet-300" : "text-zinc-600"}`}>
              {occupancy}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function CaseCarousel(props: {
  frame?: { height: number; left: number; top: number; width: number };
  graph: SourceReviewGraph;
  vertical: boolean;
}) {
  const names = props.graph.caseNames;
  const selectedIndex = Math.max(0, names.indexOf(props.graph.selectedCase ?? ""));
  const selected = names[selectedIndex];
  const canCycle = names.length > 1 && Boolean(props.graph.onCaseChange);
  const previous = names[(selectedIndex - 1 + names.length) % names.length];
  const next = names[(selectedIndex + 1) % names.length];
  const cycle = (direction: -1 | 1) => {
    if (!canCycle) return;
    props.graph.onCaseChange?.(names[(selectedIndex + direction + names.length) % names.length]!);
  };
  const PreviousIcon = props.vertical ? ChevronUp : ChevronLeft;
  const NextIcon = props.vertical ? ChevronDown : ChevronRight;

  if (props.vertical) {
    return (
      <div
        className="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-center justify-between"
        data-testid="source-review-case-carousel"
        style={props.frame ? {
          height: props.frame.height + 80,
          left: props.frame.left + props.frame.width / 2,
          top: props.frame.top - 40,
        } : undefined}
      >
        <div className="pointer-events-auto flex items-center rounded-full bg-[#15161a] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.22)]" data-design-space-canvas-chrome>
          <Button isIconOnly aria-label="Previous design case" className="size-7 min-w-7 text-zinc-400" isDisabled={!canCycle} size="sm" variant="ghost" onPress={() => cycle(-1)}>
            <ChevronUp size={13} />
          </Button>
          <CaseLabel count={names.length} index={selectedIndex} selected={selected} />
        </div>
        <Button
          isIconOnly
          aria-label="Next design case"
          className="pointer-events-auto size-8 min-w-8 rounded-full border-0 bg-[#15161a] text-zinc-400 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
          data-design-space-canvas-chrome
          isDisabled={!canCycle}
          size="sm"
          variant="ghost"
          onPress={() => cycle(1)}
        >
          <ChevronDown size={13} />
        </Button>
        {canCycle ? <span className="sr-only">Previous: {previous}. Next: {next}.</span> : null}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute z-10 flex -translate-x-1/2 items-center rounded-full bg-[#15161a] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
      data-design-space-canvas-chrome
      data-testid="source-review-case-carousel"
      style={props.frame ? {
        left: props.frame.left + props.frame.width / 2,
        top: Math.max(4, props.frame.top - 44),
      } : undefined}
    >
      <Button isIconOnly aria-label="Previous design case" className="size-7 min-w-7 text-zinc-400" isDisabled={!canCycle} size="sm" variant="ghost" onPress={() => cycle(-1)}>
        <PreviousIcon size={13} />
      </Button>
      <CaseLabel count={names.length} index={selectedIndex} selected={selected} />
      <Button isIconOnly aria-label="Next design case" className="size-7 min-w-7 text-zinc-400" isDisabled={!canCycle} size="sm" variant="ghost" onPress={() => cycle(1)}>
        <NextIcon size={13} />
      </Button>
      {canCycle ? (
        <span className="sr-only">Previous: {previous}. Next: {next}.</span>
      ) : null}
    </div>
  );
}

function CaseLabel(props: { count: number; index: number; selected?: string }) {
  return (
    <div className="flex max-w-72 min-w-0 items-center gap-2 px-2">
      <Route aria-hidden="true" className="shrink-0 text-violet-300" size={12} />
      <span className="min-w-0 truncate text-[10px] font-medium text-zinc-100">{props.selected ?? "Structure"}</span>
      <span className="shrink-0 text-[8px] tabular-nums text-zinc-600">{props.count ? `${props.index + 1}/${props.count}` : "Static"}</span>
    </div>
  );
}

function GraphModeButton(props: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={350}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={`size-6 min-w-6 ${props.active ? "bg-violet-400/15 text-violet-200" : "text-zinc-500"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
