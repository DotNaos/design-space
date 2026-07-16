import { describe, expect, it } from "vitest";

import { targetRouteName } from "./target-route-name";

describe("target route name", () => {
  it("keeps Design Space stable and separates other targets", () => {
    expect(targetRouteName("design-space")).toBe("design-space");
    expect(targetRouteName("project-space")).toBe("project-space-design-space");
    expect(targetRouteName("Client Web / Demo")).toBe("client-web-demo-design-space");
  });
});
