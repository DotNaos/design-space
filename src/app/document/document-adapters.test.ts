import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import { wouldCreateAuthoredComponentCycle } from "./document-adapters";

const component = (id: string, adapterId = "stack"): DesignDocument => ({
  schemaVersion: 2,
  id: `component.${id}`,
  label: id,
  kind: "component",
  component: { id, label: id, group: "Custom", properties: [], slots: [] },
  root: { instanceId: `${id}.root`, adapterId, slots: {} },
});

describe("authored component cycle guard", () => {
  it("rejects self references and candidates that lead back to the edited component", () => {
    const alpha = component("alpha");
    const beta = component("beta", "alpha");
    expect(wouldCreateAuthoredComponentCycle(alpha, [alpha, beta], "alpha")).toBe(true);
    expect(wouldCreateAuthoredComponentCycle(alpha, [alpha, beta], "beta")).toBe(true);
    expect(wouldCreateAuthoredComponentCycle(alpha, [alpha, beta], "stack")).toBe(false);
  });
});
