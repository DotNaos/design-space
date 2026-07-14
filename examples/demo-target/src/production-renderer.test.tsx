import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  renderProductionDocument,
  type ProductionComponentDocument,
  type ProductionScreenDocument,
} from "./production-renderer";

afterEach(cleanup);

describe("target-owned production renderer", () => {
  it("resolves a nested authored component with its own property bindings", () => {
    const label: ProductionComponentDocument = {
      id: "component.label",
      component: {
        id: "label",
        properties: [{ id: "property.label.text", prop: "text", defaultValue: "Default label" }],
      },
      root: {
        instanceId: "label.heading",
        adapterId: "heading",
        propertyBindings: { children: "property.label.text" },
        slots: {},
      },
    };
    const panel: ProductionComponentDocument = {
      id: "component.panel",
      component: {
        id: "panel",
        properties: [{ id: "property.panel.label", prop: "label" }],
      },
      root: {
        instanceId: "panel.stack",
        adapterId: "stack",
        slots: {
          content: [{
            kind: "component",
            node: {
              instanceId: "panel.label",
              adapterId: "label",
              propertyBindings: { text: "property.panel.label" },
              slots: {},
            },
          }],
        },
      },
    };
    const screenDocument: ProductionScreenDocument = {
      id: "screen.home",
      root: {
        instanceId: "home.panel",
        adapterId: "panel",
        props: { label: "Nested authored component" },
        slots: {},
      },
    };

    render(<>{renderProductionDocument(screenDocument, [panel, label])}</>);

    expect(screen.getByRole("heading", { name: "Nested authored component" })).toBeVisible();
  });
});
