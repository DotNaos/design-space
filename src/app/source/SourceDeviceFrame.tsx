import type { ReactNode } from "react";

import desktopFrameUrl from "../../../config/prototype-device-overlays/desktop.png?url";
import phoneFrameUrl from "../../../config/prototype-device-overlays/phone.png?url";
import tabletFrameUrl from "../../../config/prototype-device-overlays/tablet.png?url";
import { sourceDeviceFrameLayout, type SourceDeviceFrameKind } from "./source-device-frame";

const frameUrls = {
  desktop: desktopFrameUrl,
  phone: phoneFrameUrl,
  tablet: tabletFrameUrl,
} as const;

export function SourceDeviceFrame(props: {
  children: ReactNode;
  kind: SourceDeviceFrameKind;
  screenHeight: number;
  screenWidth: number;
}) {
  const layout = sourceDeviceFrameLayout(props.kind, props.screenWidth, props.screenHeight);
  const borderRadius = props.kind === "phone" ? 44 : props.kind === "tablet" ? 24 : 0;

  return (
    <div
      aria-label={`${props.kind} device frame`}
      className="relative"
      style={{ height: layout.outerHeight, width: layout.outerWidth }}
    >
      <div
        className="absolute overflow-hidden bg-[#111216]"
        style={{
          borderRadius,
          height: layout.screenHeight,
          left: layout.screenLeft,
          top: layout.screenTop,
          width: layout.screenWidth,
        }}
      >
        {props.children}
      </div>
      <img
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full select-none drop-shadow-[0_24px_36px_rgba(0,0,0,0.42)]"
        draggable={false}
        src={frameUrls[props.kind]}
      />
    </div>
  );
}
