import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileDock } from "./MobileDock";

afterEach(cleanup);

describe("MobileDock", () => {
  it("makes documents, files, tree, canvas, catalog, and inspect first-class mobile views", async () => {
    const onChange = vi.fn();
    render(<MobileDock active="catalog" onChange={onChange} />);

    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(onChange).toHaveBeenCalledWith("files");
  });
});
