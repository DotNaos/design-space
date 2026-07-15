import type { ViewRect } from "./canvas-overlay-geometry";
import type { CanvasGridMode, CanvasLayoutGridSettings } from "./canvas-grid-types";

type GridPresentation = {
  anchorX: number;
  anchorY: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
  dotRadius: number;
  opacity: number;
  screenStep: number;
  worldStep: number;
};

export function CanvasGridLayer(props: {
  grid: GridPresentation;
  layoutGrid: CanvasLayoutGridSettings;
  mode: CanvasGridMode;
  rootRect?: ViewRect;
  scale: number;
  visible: boolean;
}) {
  const pixelGrid = isPixelGridScale(props.scale);
  const baseBackground = props.mode === "dots"
    ? {
      image: `radial-gradient(circle, #52525b ${props.grid.dotRadius}px, transparent ${props.grid.dotRadius}px)`,
      position: `${props.grid.backgroundPositionX}px ${props.grid.backgroundPositionY}px`,
    }
    : {
      image: lineGridImage("rgba(82, 82, 91, 1)", 1),
      position: `${props.grid.anchorX}px ${props.grid.anchorY}px`,
    };

  return (
    <>
      {props.visible && (
        <div
          className={`pointer-events-none absolute inset-0 ${pixelGrid ? "z-[8]" : ""}`}
          data-dot-radius={props.grid.dotRadius}
          data-grid-mode={pixelGrid ? "pixels" : props.mode}
          data-testid="canvas-grid"
          data-world-step={pixelGrid ? 1 : props.grid.worldStep}
          style={pixelGrid ? pixelGridStyle(props.grid, props.scale) : {
            backgroundImage: baseBackground.image,
            backgroundPosition: baseBackground.position,
            backgroundSize: `${props.grid.screenStep}px ${props.grid.screenStep}px`,
            opacity: props.grid.opacity,
          }}
        />
      )}
      {props.layoutGrid.enabled && (
        <LayoutGridOverlay grid={props.grid} rootRect={props.rootRect} settings={props.layoutGrid} scale={props.scale} />
      )}
    </>
  );
}

export function isPixelGridScale(scale: number): boolean {
  return scale >= 32 - 0.001;
}

function LayoutGridOverlay(props: {
  grid: GridPresentation;
  rootRect?: ViewRect;
  settings: CanvasLayoutGridSettings;
  scale: number;
}) {
  const screenStep = props.settings.size * props.scale;
  const image = lineGridImage(hexWithAlpha(props.settings.color, 0.48), 0.75);
  const position = `${props.grid.anchorX}px ${props.grid.anchorY}px`;
  const root = props.rootRect;
  const fadeMask = root ? canvasFadeMask(root) : undefined;
  const backgroundOpacity = Math.max(0.035, Math.min(0.09, props.scale * 0.09));
  const uiOpacity = Math.max(0.16, Math.min(0.3, props.scale * 0.3));

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[8]"
        data-layout-grid-layer="fade"
        data-layout-grid-step={props.settings.size}
        style={{
          backgroundImage: image,
          backgroundPosition: position,
          backgroundSize: `${screenStep}px ${screenStep}px`,
          maskImage: fadeMask,
          opacity: backgroundOpacity,
        }}
      />
      {root && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[9]"
          data-layout-grid-layer="ui"
          style={{
            backgroundImage: image,
            backgroundPosition: `${props.grid.anchorX - root.left}px ${props.grid.anchorY - root.top}px`,
            backgroundSize: `${screenStep}px ${screenStep}px`,
            height: root.height,
            left: root.left,
            opacity: uiOpacity,
            top: root.top,
            width: root.width,
          }}
        />
      )}
    </>
  );
}

function pixelGridStyle(grid: GridPresentation, scale: number): React.CSSProperties {
  return {
    backgroundImage: lineGridImage("rgba(226, 232, 240, 0.12)", 0.5),
    backgroundPosition: `${grid.anchorX}px ${grid.anchorY}px`,
    backgroundSize: `${scale}px ${scale}px`,
  };
}

function canvasFadeMask(root: ViewRect): string {
  const radiusX = Math.max(260, root.width * 0.8);
  const radiusY = Math.max(220, root.height * 0.9);
  const centerX = root.left + root.width / 2;
  const centerY = root.top + root.height / 2;
  return `radial-gradient(ellipse ${radiusX}px ${radiusY}px at ${centerX}px ${centerY}px, black 25%, transparent 100%)`;
}

function lineGridImage(color: string, lineWidth: number): string {
  return `linear-gradient(to right, ${color} ${lineWidth}px, transparent ${lineWidth}px), linear-gradient(to bottom, ${color} ${lineWidth}px, transparent ${lineWidth}px)`;
}

function hexWithAlpha(color: string, alpha: number): string {
  const normalized = color.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((character) => character + character).join("")
    : normalized;
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number) || value.length !== 6) return `rgba(34, 211, 238, ${alpha})`;
  return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}
