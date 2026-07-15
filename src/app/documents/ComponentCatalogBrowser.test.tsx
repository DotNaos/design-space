import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentAdapterView } from "../document/document-adapters";
import { ComponentCatalogBrowser } from "./ComponentCatalogBrowser";

afterEach(cleanup);

const targetAdapter = {
  component: { id: "target.card", label: "Card", group: "Layout", slots: [{ id: "body", label: "Body" }] },
  render: () => null,
};

const entries: readonly DocumentAdapterView[] = [
  {
    component: targetAdapter.component,
    controls: [],
    defaultProps: {},
    targetAdapter,
  },
  {
    component: { id: "authored.profile", label: "Profile summary", group: "Product", description: "Account identity", slots: [] },
    controls: [],
    defaultProps: {},
  },
];

describe("ComponentCatalogBrowser", () => {
  it("groups the complete catalog and exposes origin, status, and slot metadata", () => {
    render(<ComponentCatalogBrowser entries={entries} selectedComponentId="target.card" onSelect={() => undefined} />);

    expect(screen.getByRole("button", { name: /Layout 1/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Card Target Read only 1 slot/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Profile summary Authored Editable No slots/ })).toBeInTheDocument();
  });

  it("searches labels, descriptions, and origin metadata then selects a result", async () => {
    const onSelect = vi.fn();
    render(<ComponentCatalogBrowser entries={entries} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole("textbox", { name: "Search component catalog" }), "account");
    expect(screen.queryByRole("button", { name: /Card Target/ })).not.toBeInTheDocument();
    const authored = screen.getByRole("button", { name: /Profile summary Authored/ });
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    await userEvent.click(authored);
    expect(onSelect).toHaveBeenCalledWith("authored.profile");

    await userEvent.clear(screen.getByRole("textbox", { name: "Search component catalog" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Search component catalog" }), "read only");
    expect(screen.getByRole("button", { name: /Card Target/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Profile summary Authored/ })).not.toBeInTheDocument();
  });

  it("collapses and expands component groups", async () => {
    render(<ComponentCatalogBrowser entries={entries} onSelect={() => undefined} />);
    const group = screen.getByRole("button", { name: /Layout 1/ });
    await userEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Card Target/ })).not.toBeInTheDocument();
    await userEvent.click(group);
    expect(screen.getByRole("button", { name: /Card Target/ })).toBeInTheDocument();
  });
});
