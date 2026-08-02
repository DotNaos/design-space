import type { CanvasCamera } from "../../canvas-transform";

export type CanvasWorldChromeLayout = {
  footerBottom?: number;
  footerHeight: number;
  footerInlineMargin?: number;
  headerHeight: number;
  worldHeight: number;
  worldWidth: number;
};

export function applyCanvasWorldChromeCamera(
  root: HTMLElement,
  camera: CanvasCamera,
  layout: CanvasWorldChromeLayout,
): void {
  const header = root.querySelector<HTMLElement>('[data-canvas-world-chrome="header"]');
  if (!header?.hasAttribute("data-canvas-world-chrome-pinned")) {
    positionChrome(header, {
      height: layout.headerHeight,
      left: camera.x,
      top: camera.y - layout.headerHeight,
      width: layout.worldWidth * camera.scale,
    });
  }
  const footer = root.querySelector<HTMLElement>('[data-canvas-world-chrome="footer"]');
  if (!footer?.hasAttribute("data-canvas-world-chrome-pinned")) {
    positionChrome(footer, {
      height: layout.footerHeight,
      left: camera.x,
      top: camera.y + layout.worldHeight * camera.scale,
      width: layout.worldWidth * camera.scale,
    });
  }
}

export function CanvasWorldChrome(props: {
  camera: CanvasCamera;
  footer?: React.ReactNode;
  footerBottom?: number;
  footerClassName?: string;
  footerHeight: number;
  footerInlineMargin?: number;
  header?: React.ReactNode;
  headerHeight: number;
  headerInlineMargin?: number;
  headerTop?: number;
  pinHeader?: boolean;
  pinFooter?: boolean;
  worldHeight: number;
  worldWidth: number;
}) {
  return (
    <>
      {props.header ? (
        <div
          className="pointer-events-auto absolute"
          data-canvas-world-chrome="header"
          data-canvas-world-chrome-pinned={props.pinHeader ? "" : undefined}
          data-design-space-canvas-chrome
          data-testid="canvas-world-header"
          style={props.pinHeader ? {
            height: props.headerHeight,
            left: "50%",
            top: props.headerTop ?? 56,
            transform: "translateX(-50%)",
            width: `min(calc(100% - ${(props.headerInlineMargin ?? 16) * 2}px), ${props.worldWidth}px)`,
          } : {
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
          className={`pointer-events-auto absolute ${props.footerClassName ?? ""}`}
          data-canvas-world-chrome="footer"
          data-canvas-world-chrome-pinned={props.pinFooter ? "" : undefined}
          data-design-space-canvas-chrome
          data-testid="canvas-world-footer"
          style={props.pinFooter ? {
            bottom: props.footerBottom,
            height: props.footerHeight,
            left: "50%",
            transform: "translateX(-50%)",
            width: `min(calc(100% - ${(props.footerInlineMargin ?? 16) * 2}px), ${props.worldWidth}px)`,
          } : {
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

function positionChrome(
  element: HTMLElement | null,
  rect: { height: number; left: number; top: number; width: number },
): void {
  if (!element) return;
  element.style.height = `${rect.height}px`;
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
}
