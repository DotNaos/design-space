import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { SourceViewportPicker } from "./SourceViewportPicker";

afterEach(cleanup);

it("keeps the trigger compact while showing exact dimensions in the menu", async () => {
  render(
    <SourceViewportPicker
      clipToScreen
      device="mobile"
      presetId="mobile-390"
      responsiveWidth={960}
      showDeviceFrame={false}
      showDeviceTabs={false}
      onClipToScreenChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onPresetChange={vi.fn()}
      onResponsiveWidthChange={vi.fn()}
      onShowDeviceFrameChange={vi.fn()}
    />,
  );

  const trigger = screen.getByRole("button", { name: /Preview dimensions/ });
  expect(trigger).toHaveTextContent("Mobile");
  expect(trigger.querySelector("svg")).toBeTruthy();
  expect(within(trigger).getByText("Mobile")).toHaveClass("text-[8px]");
  expect(trigger).not.toHaveTextContent("390 × 844");

  await userEvent.click(trigger);
  const selectedOption = await screen.findByRole("option", { name: "390 × 844" });
  expect(screen.getAllByText("Responsive").length).toBeGreaterThan(0);
  expect(screen.getByText("Desktop")).toBeVisible();
  expect(screen.getByText("Tablet")).toBeVisible();
  expect(screen.getAllByText("Mobile").length).toBeGreaterThan(1);
  expect(selectedOption).toBeVisible();
  expect(selectedOption.querySelector("svg")).toBeTruthy();
  expect(screen.getByRole("option", { name: "Mobile 430 × 932" })).toBeVisible();
  expect(screen.getByRole("option", { name: "375 × 812" })).toBeVisible();
});
