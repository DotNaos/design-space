import type { ViewRect } from "../PreviewCanvas/canvas-overlay-geometry";
import type { CanvasGridMode, CanvasLayoutGridSettings } from "./canvas-grid-types";
import { LayoutGridOverlay } from "./LayoutGridOverlay";

export type GridPresentation = {
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

function pixelGridStyle(grid: GridPresentation, scale: number): React.CSSProperties {
  return {
    backgroundImage: lineGridImage("rgba(226, 232, 240, 0.12)", 0.5),
    backgroundPosition: `${grid.anchorX}px ${grid.anchorY}px`,
    backgroundSize: `${scale}px ${scale}px`,
  };
}

export function canvasFadeMask(root: ViewRect): string {
  const radiusX = Math.max(260, root.width * 0.8);
  const radiusY = Math.max(220, root.height * 0.9);
  const centerX = root.left + root.width / 2;
  const centerY = root.top + root.height / 2;
  return `radial-gradient(ellipse ${radiusX}px ${radiusY}px at ${centerX}px ${centerY}px, black 25%, transparent 100%)`;
}

export function lineGridImage(color: string, lineWidth: number): string {
  return `linear-gradient(to right, ${color} ${lineWidth}px, transparent ${lineWidth}px), linear-gradient(to bottom, ${color} ${lineWidth}px, transparent ${lineWidth}px)`;
}

export function hexWithAlpha(color: string, alpha: number): string {
  const normalized = color.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((character) => character + character).join("")
    : normalized;
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number) || value.length !== 6) return `rgba(34, 211, 238, ${alpha})`;
  return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}
