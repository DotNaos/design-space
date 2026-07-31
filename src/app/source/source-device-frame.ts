import overlayConfig from "../../../config/prototype-device-overlays.json";

import type { DesignSpaceDevice } from "../../shared/source-workspace";

export type SourceDeviceFrameKind = keyof typeof overlayConfig;

export interface SourceDeviceFrameLayout {
  outerHeight: number;
  outerWidth: number;
  screenHeight: number;
  screenLeft: number;
  screenTop: number;
  screenWidth: number;
}

export function sourceDeviceFrameKind(device: DesignSpaceDevice): SourceDeviceFrameKind {
  if (device === "mobile") return "phone";
  return device;
}

export function sourceDeviceFrameLayout(
  kind: SourceDeviceFrameKind,
  screenWidth: number,
  screenHeight: number,
): SourceDeviceFrameLayout {
  const overlay = overlayConfig[kind];
  const horizontalScale = screenWidth / overlay.screen.width;
  const verticalScale = screenHeight / overlay.screen.height;
  return {
    outerHeight: overlay.image.height * verticalScale,
    outerWidth: overlay.image.width * horizontalScale,
    screenHeight,
    screenLeft: overlay.screen.x * horizontalScale,
    screenTop: overlay.screen.y * verticalScale,
    screenWidth,
  };
}
