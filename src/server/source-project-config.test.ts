import { describe, expect, it } from "vitest";

import { parseSourceProjectConfig } from "./source-project-config";

describe("source project config", () => {
  it("accepts project identity and an explicit device strategy", () => {
    expect(parseSourceProjectConfig({
      project: { id: "project-template-web", label: "Project Template Web" },
      tablet: { fallback: "desktop" },
    })).toEqual({
      project: { id: "project-template-web", label: "Project Template Web" },
      tablet: { fallback: "desktop" },
    });
    expect(parseSourceProjectConfig({
      project: { id: "responsive-app", label: "Responsive app" },
      devices: { mode: "responsive" },
      source: { layout: "src/design-space/app.tsx" },
    })).toMatchObject({ devices: { mode: "responsive" } });
  });

  it("keeps an explicit target-owned layout inside TypeScript source", () => {
    expect(parseSourceProjectConfig({
      project: { id: "self-hosted", label: "Self hosted" },
      source: { layout: "src/design-space/app.tsx" },
    })).toMatchObject({ source: { layout: "src/design-space/app.tsx" } });
    expect(() => parseSourceProjectConfig({
      project: { id: "unsafe", label: "Unsafe" },
      source: { layout: "../outside.tsx" },
    })).toThrow("valid Design Space project config");
  });

  it("accepts a fixed trusted development-library root", () => {
    expect(parseSourceProjectConfig({
      project: { id: "library-host", label: "Library host" },
      library: {
        package: "@dotnaos/react-ui",
        development: {
          root: "../ui",
        },
      },
    })).toMatchObject({ library: { package: "@dotnaos/react-ui" } });
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
