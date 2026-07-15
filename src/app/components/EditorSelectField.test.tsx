import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorSelectField } from "./EditorSelectField";

afterEach(cleanup);

describe("EditorSelectField", () => {
  it("selects options through an accessible HeroUI listbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EditorSelectField
        ariaLabel="Layout mode"
        label="Layout"
        options={[
          { id: "auto", label: "Auto", value: "" },
          { id: "flex", label: "Flex", value: "flex" },
        ]}
        value=""
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Layout mode/ });
    expect(trigger).toHaveTextContent("Auto");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Flex" }));

    expect(onChange).toHaveBeenCalledWith("flex");
  });

  it("shows a disabled selected sentinel without allowing it to be chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EditorSelectField
        ariaLabel="Binding"
        label="Binding"
        options={[
          { id: "none", label: "Not bound", value: "" },
          { id: "stale", label: "Unavailable binding", value: "__unavailable__", disabled: true },
        ]}
        value="__unavailable__"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Binding/ });
    expect(trigger).toHaveTextContent("Unavailable binding");
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Unavailable binding" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("option", { name: "Not bound" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps the options inside a native mobile editor dialog", async () => {
    const user = userEvent.setup();
    render(
      <dialog aria-label="Mobile item editor" open>
        <EditorSelectField
          ariaLabel="Padding"
          label="Padding"
          options={[
            { id: "auto", label: "Auto", value: "" },
            { id: "p-4", label: "p-4", value: "p-4" },
          ]}
          value=""
          onChange={vi.fn()}
        />
      </dialog>,
    );

    await user.click(screen.getByRole("button", { name: /Padding/ }));

    const editor = screen.getByRole("dialog", { name: "Mobile item editor" });
    expect(editor).toContainElement(screen.getByRole("listbox", { name: /Padding/ }));
  });
});
