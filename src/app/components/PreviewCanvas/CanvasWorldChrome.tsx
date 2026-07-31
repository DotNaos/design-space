import type { CanvasCamera } from "../../canvas-transform";

export function CanvasWorldChrome(props: {
  camera: CanvasCamera;
  footer?: React.ReactNode;
  footerHeight: number;
  header?: React.ReactNode;
  headerHeight: number;
  worldHeight: number;
  worldWidth: number;
}) {
  return (
    <>
      {props.header ? (
        <div
          className="pointer-events-auto absolute"
          data-design-space-canvas-chrome
          data-testid="canvas-world-header"
          style={{
            height: props.headerHeight,
            left: props.camera.x,
            top: props.camera.y - props.headerHeight,
            width: props.worldWidth * props.camera.scale,
          }}
        >
          {props.header}
        </div>
      ) : null}
      {props.footer ? (
        <div
          className="pointer-events-auto absolute"
          data-design-space-canvas-chrome
          data-testid="canvas-world-footer"
          style={{
            height: props.footerHeight,
            left: props.camera.x,
            top: props.camera.y + props.worldHeight * props.camera.scale,
            width: props.worldWidth * props.camera.scale,
          }}
        >
          {props.footer}
        </div>
      ) : null}
    </>
  );
}
