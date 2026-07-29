import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../components/PreviewCanvas/PreviewCanvas", () => ({
  PreviewCanvas: (props: {
    preview: React.ReactNode;
    toolbar?: React.ReactNode;
  }) => (
    <div>
      {props.toolbar}
      {props.preview}
    </div>
  ),
}));

import { SourceCanvasViewport } from "./SourceCanvasViewport";

afterEach(cleanup);

it("switches between the selected screen and measured content bounds", async () => {
  render(
    <SourceCanvasViewport
      contentSize={{ height: 420, width: 360 }}
      device="desktop"
      onDeviceChange={vi.fn()}
    >
      {(frame) => <output>{`${frame.width} × ${frame.height}`}</output>}
    </SourceCanvasViewport>,
  );

  const screenFrame = document.querySelector<HTMLElement>("[data-preview-frame-mode]");
  expect(screenFrame).toHaveAttribute("data-preview-frame-mode", "screen");
  expect(screenFrame).toHaveClass("overflow-hidden");
  expect(screenFrame).toHaveStyle({ height: "800px", width: "1280px" });
  expect(screen.getByText("1280 × 800")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Clip preview to selected screen" }));

  const contentFrame = document.querySelector<HTMLElement>("[data-preview-frame-mode]");
  expect(contentFrame).toHaveAttribute("data-preview-frame-mode", "content");
  expect(contentFrame).toHaveClass("overflow-visible");
  expect(contentFrame).toHaveStyle({ height: "420px", width: "360px" });
  expect(screen.getByText("360 × 420")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hug preview content" })).toBeVisible();
});
