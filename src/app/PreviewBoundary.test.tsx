import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { PreviewBoundary } from "./PreviewBoundary";

it("can explain a direct target runtime failure without referring to a generated class edit", () => {
  const Broken = () => {
    throw new Error("broken target");
  };
  const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    render(
      <PreviewBoundary
        resetKey="target"
        errorTitle="Target preview crashed"
        errorMessage="Fix the target source or its required runtime context to recover."
      >
        <Broken />
      </PreviewBoundary>,
    );
  } finally {
    report.mockRestore();
  }
  expect(screen.getByText("Target preview crashed")).toBeVisible();
  expect(screen.getByText("Fix the target source or its required runtime context to recover.")).toBeVisible();
});
