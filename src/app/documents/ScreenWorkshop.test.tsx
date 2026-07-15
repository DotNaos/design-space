import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import { ScreenWorkshop } from "./ScreenWorkshop";

it("renames a screen through the source-backed mobile settings panel", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onEditRoot = vi.fn();
  function Harness() {
    const [current, setCurrent] = useState(document);
    return <ScreenWorkshop document={current} onChange={(next) => { onChange(next); setCurrent(next); }} onEditRoot={onEditRoot} />;
  }
  render(<Harness />);

  expect(screen.getByRole("complementary")).toHaveClass("h-full", "min-h-0", "overflow-y-auto");
  await user.clear(screen.getByRole("textbox", { name: "Screen name" }));
  await user.type(screen.getByRole("textbox", { name: "Screen name" }), "Settings");
  expect(onChange.mock.lastCall?.[0]).toMatchObject({ id: "screen.home", label: "Settings" });

  await user.click(screen.getByRole("button", { name: "Edit root component" }));
  expect(onEditRoot).toHaveBeenCalledOnce();
});

const document: DesignDocument = {
  schemaVersion: 2,
  id: "screen.home",
  label: "Home",
  kind: "screen",
  root: { instanceId: "home.root", adapterId: "stack", slots: { content: [] } },
};
