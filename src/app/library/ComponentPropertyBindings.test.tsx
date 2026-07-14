import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import { ComponentPropertyBindings } from "./ComponentPropertyBindings";

afterEach(cleanup);

describe("ComponentPropertyBindings", () => {
  it("offers only compatible implementation controls and stores or clears a stable property binding", async () => {
    const onChange = vi.fn();
    const document: DesignDocument = {
      schemaVersion: 2,
      id: "component.hero",
      label: "Hero",
      kind: "component",
      component: {
        id: "hero",
        label: "Hero",
        group: "Custom",
        properties: [{ id: "title", label: "Title", prop: "title", kind: "text" }],
        slots: [],
      },
      root: { instanceId: "hero.heading", adapterId: "heading", slots: {} },
    };
    const view = render(
      <ComponentPropertyBindings
        document={document}
        catalogComponents={[{
          id: "heading",
          label: "Heading",
          group: "Typography",
          controls: [
            { id: "content", label: "Content", kind: "text", prop: "children" },
            { id: "surface", label: "Surface", kind: "tailwind", prop: "className" },
          ],
        }]}
        onChange={onChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Binding for Title" });
    expect(select).toHaveTextContent("Heading · Content");
    expect(select).not.toHaveTextContent("Heading · Surface");
    await userEvent.selectOptions(select, "0");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      root: expect.objectContaining({ propertyBindings: { children: "title" } }),
    }));

    const bound = onChange.mock.calls.at(-1)?.[0] as DesignDocument;
    view.rerender(
      <ComponentPropertyBindings
        document={bound}
        catalogComponents={[{
          id: "heading",
          label: "Heading",
          group: "Typography",
          controls: [
            { id: "content", label: "Content", kind: "text", prop: "children" },
            { id: "surface", label: "Surface", kind: "tailwind", prop: "className" },
          ],
        }]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Binding for Title" }), "");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      root: expect.not.objectContaining({ propertyBindings: expect.anything() }),
    }));
  });

  it("shows and clears a binding whose target is no longer compatible", async () => {
    const onChange = vi.fn();
    const document: DesignDocument = {
      schemaVersion: 2,
      id: "component.hero",
      label: "Hero",
      kind: "component",
      component: {
        id: "hero",
        label: "Hero",
        group: "Custom",
        properties: [{ id: "title", label: "Title", prop: "title", kind: "text" }],
        slots: [],
      },
      root: {
        instanceId: "hero.heading",
        adapterId: "heading",
        propertyBindings: { className: "title" },
        slots: {},
      },
    };
    render(
      <ComponentPropertyBindings
        document={document}
        catalogComponents={[{
          id: "heading",
          label: "Heading",
          group: "Typography",
          controls: [
            { id: "content", label: "Content", kind: "text", prop: "children" },
            { id: "surface", label: "Surface", kind: "tailwind", prop: "className" },
          ],
        }]}
        onChange={onChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Binding for Title" });
    expect(select).toHaveValue("__unavailable__");
    expect(select).toHaveTextContent("Unavailable binding");
    await userEvent.selectOptions(select, "");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      root: expect.not.objectContaining({ propertyBindings: expect.anything() }),
    }));
  });
});
