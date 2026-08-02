import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffSheet } from "./DiffSheet";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

describe("DiffSheet", () => {
  it("presents the prepared diff as a dismissable modal", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<DiffSheet diff="-old\n+new\n" saving={false} onClose={onClose} onSave={onSave} />);

    expect(await screen.findByRole("dialog", { name: "Exact source diff" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Close diff" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not mount a mobile-only diff backdrop on desktop", () => {
    mockDesktopViewport();

    render(<DiffSheet desktopHidden diff="-old\n+new\n" saving={false} onClose={() => undefined} onSave={() => undefined} />);

    expect(screen.queryByRole("dialog", { name: "Exact source diff" })).not.toBeInTheDocument();
  });

  it("keeps the document creation diff available on desktop", async () => {
    mockDesktopViewport();

    render(<DiffSheet diff="-old\n+new\n" saving={false} onClose={() => undefined} onSave={() => undefined} />);

    expect(await screen.findByRole("dialog", { name: "Exact source diff" })).toBeInTheDocument();
  });
});

function mockDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}
