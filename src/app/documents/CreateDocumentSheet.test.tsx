import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentCreationRecipeEntry } from "../../shared/document-transactions";
import { CreateDocumentSheet } from "./CreateDocumentSheet";

afterEach(cleanup);

const recipes: readonly DocumentCreationRecipeEntry[] = [
  {
    id: "recipe.screen.blank",
    label: "Blank screen",
    description: "A screen with one empty content slot.",
    kind: "screen",
  },
  {
    id: "recipe.screen.stack",
    label: "Stack screen",
    description: "A vertical screen layout.",
    kind: "screen",
  },
  {
    id: "recipe.component.panel",
    label: "Panel component",
    description: "A component with a body slot.",
    kind: "component",
  },
];

describe("CreateDocumentSheet", () => {
  it("shows only recipes for the current product mode and prepares the selected recipe with a trimmed label", async () => {
    const onPrepare = vi.fn();
    render(
      <CreateDocumentSheet
        open
        mode="app"
        recipes={recipes}
        busy={false}
        onClose={() => undefined}
        onPrepare={onPrepare}
      />,
    );

    expect(await screen.findByRole("dialog", { name: "Create screen" })).toBeInTheDocument();
    expect(screen.getByText("Blank screen")).toBeInTheDocument();
    expect(screen.getByText("Stack screen")).toBeInTheDocument();
    expect(screen.queryByText("Panel component")).not.toBeInTheDocument();

    const review = screen.getByRole("button", { name: "Review source" });
    expect(review).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "  Settings  ");
    await userEvent.click(screen.getByRole("button", { name: /Stack screen/ }));
    await userEvent.click(review);

    expect(onPrepare).toHaveBeenCalledOnce();
    expect(onPrepare).toHaveBeenCalledWith("recipe.screen.stack", "Settings");
  });

  it("blocks preparation when the target has no compatible recipe and surfaces the operation error", async () => {
    render(
      <CreateDocumentSheet
        open
        mode="library"
        recipes={recipes.filter((recipe) => recipe.kind === "screen")}
        busy={false}
        error="This recipe is no longer registered."
        onClose={() => undefined}
        onPrepare={vi.fn()}
      />,
    );

    expect(await screen.findByText("This target has not registered a component recipe.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This recipe is no longer registered.");
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Profile card");
    expect(screen.getByRole("button", { name: "Review source" })).toBeDisabled();
  });
});
