import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import { ComponentPropertyBindings } from "./ComponentPropertyBindings";

afterEach(cleanup);

describe("ComponentPropertyBindings", () => {
  it("offers only compatible implementation controls and stores or clears a stable property binding", async () => {
    const user = userEvent.setup();
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

    const trigger = screen.getByRole("button", { name: /Binding for Title/ });
    expect(trigger).toHaveTextContent("Not bound");
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Heading · Content" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Heading · Surface" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Heading · Content" }));
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
    await user.click(screen.getByRole("button", { name: /Binding for Title/ }));
    await user.click(screen.getByRole("option", { name: "Not bound" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      root: expect.not.objectContaining({ propertyBindings: expect.anything() }),
    }));
  });

  it("shows and clears a binding whose target is no longer compatible", async () => {
    const user = userEvent.setup();
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

    const trigger = screen.getByRole("button", { name: /Binding for Title/ });
    expect(trigger).toHaveTextContent("Unavailable binding");
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Unavailable binding" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("option", { name: "Not bound" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      root: expect.not.objectContaining({ propertyBindings: expect.anything() }),
    }));
  });
});
