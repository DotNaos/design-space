import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { SourceDesignStatus } from "./SourceDesignStatus";

afterEach(cleanup);

it("explains a missing design and its expected colocated path", () => {
  render(<SourceDesignStatus designPath="src/components/Button.design.tsx" label="Button" />);

  expect(screen.getByLabelText("Button design missing")).toHaveAttribute(
    "title",
    "Design file missing · src/components/Button.design.tsx",
  );
  expect(screen.getByLabelText("Button design missing")).toHaveClass("rounded-full", "bg-rose-500", "text-white");
  expect(screen.getByLabelText("Button design missing").querySelector("svg")).toHaveClass("text-white");
});
