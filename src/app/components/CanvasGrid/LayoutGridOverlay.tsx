import type { ViewRect } from "../PreviewCanvas/canvas-overlay-geometry";
import type { CanvasLayoutGridSettings } from "./canvas-grid-types";
import { GridPresentation, canvasFadeMask, hexWithAlpha, lineGridImage } from "./CanvasGridLayer";

export function LayoutGridOverlay(props: {
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
