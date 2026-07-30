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

  it("accepts a trusted independent library project and rejects unsafe locations", () => {
    expect(parseSourceProjectConfig({
      project: { id: "library-host", label: "Library host" },
      library: {
        package: "@dotnaos/react-ui",
        project: {
          repository: "https://github.com/DotNaos/ui.git",
          checkoutName: "ui",
          packageRoot: "packages/react-ui",
        },
      },
    })).toMatchObject({
      library: {
        project: {
          checkoutName: "ui",
          packageRoot: "packages/react-ui",
        },
      },
    });
    expect(() => parseSourceProjectConfig({
      project: { id: "unsafe", label: "Unsafe" },
      library: {
        package: "@dotnaos/react-ui",
        project: {
          repository: "file:///tmp/ui",
          checkoutName: "ui",
          packageRoot: "../outside",
        },
      },
    })).toThrow("valid Design Space project config");
  });

  it("accepts a project-local approval policy without embedding trust material", () => {
    expect(parseSourceProjectConfig({
      project: { id: "approved-ui", label: "Approved UI" },
      approvals: { policy: ".project/approvals/ui.yaml" },
    })).toMatchObject({
      approvals: { policy: ".project/approvals/ui.yaml" },
    });
    expect(() => parseSourceProjectConfig({
      project: { id: "unsafe", label: "Unsafe" },
      approvals: { policy: "../outside.yaml" },
    })).toThrow("valid Design Space project config");
    expect(() => parseSourceProjectConfig({
      project: { id: "unsafe", label: "Unsafe" },
      approvals: { policy: "/tmp/policy.yaml" },
    })).toThrow("valid Design Space project config");
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
