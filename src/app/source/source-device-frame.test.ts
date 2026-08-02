import { expect, it } from "vitest";

import { sourceDeviceFrameKind, sourceDeviceFrameLayout } from "./source-device-frame";

it("maps mobile previews to the phone mockup", () => {
  expect(sourceDeviceFrameKind("mobile")).toBe("phone");
  expect(sourceDeviceFrameKind("tablet")).toBe("tablet");
  expect(sourceDeviceFrameKind("desktop")).toBe("desktop");
});

it("scales the configured screen cutout with the selected viewport", () => {
  const layout = sourceDeviceFrameLayout("phone", 390, 844);
  expect(layout.screenWidth).toBe(390);
  expect(layout.screenHeight).toBe(844);
  expect(layout.outerWidth).toBeGreaterThan(layout.screenWidth);
  expect(layout.outerHeight).toBeGreaterThan(layout.screenHeight);
  expect(layout.screenLeft).toBeGreaterThan(0);
  expect(layout.screenTop).toBeGreaterThan(0);
});
