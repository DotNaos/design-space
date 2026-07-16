import { describe, expect, it } from "vitest";

import { parseSourceProjectConfig } from "./source-project-config";

describe("source project config", () => {
  it("accepts only project identity, runtime and an explicit Tablet fallback", () => {
    expect(parseSourceProjectConfig({
      project: { id: "project-template-web", label: "Project Template Web" },
      tablet: { fallback: "desktop" },
    })).toEqual({
      project: { id: "project-template-web", label: "Project Template Web" },
      tablet: { fallback: "desktop" },
    });
  });

  it("rejects generated component, slot or file manifests", () => {
    expect(() => parseSourceProjectConfig({
      project: { id: "demo", label: "Demo" },
      files: { invented: "src/Card.tsx" },
    })).toThrow(".designspace.ts");
    expect(() => parseSourceProjectConfig({
      project: { id: "demo", label: "Demo" },
      slots: [{ id: "content" }],
    })).toThrow(".designspace.ts");
  });
});
