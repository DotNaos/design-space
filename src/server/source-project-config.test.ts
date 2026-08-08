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
    })).toThrow("source.layout");
    expect(parseSourceProjectConfig({
      project: { id: "next-app", label: "Next app" },
      source: { layout: "app/layout.tsx" },
    })).toMatchObject({ source: { layout: "app/layout.tsx" } });
  });

  it("accepts project-relative layouts inside monorepo applications", () => {
    expect(parseSourceProjectConfig({
      project: { id: "production-app", label: "Production app" },
      source: { layout: "apps/production/src/App.tsx" },
    })).toMatchObject({ source: { layout: "apps/production/src/App.tsx" } });
    expect(parseSourceProjectConfig({
      project: { id: "production-app", label: "Production app" },
      source: { layout: "./apps/production/src/App.tsx" },
    })).toMatchObject({ source: { layout: "./apps/production/src/App.tsx" } });
  });

  it("accepts an explicit component catalog root without a layout", () => {
    expect(parseSourceProjectConfig({
      project: { id: "components-only", label: "Components only" },
      source: { components: "components" },
    })).toMatchObject({ source: { components: "components" } });
  });

  it("rejects unsafe or non-source monorepo layouts", () => {
    for (const layout of [
      "/apps/production/src/App.tsx",
      "apps/../production/src/App.tsx",
      "apps\\production\\src\\App.tsx",
      "apps/production/components/App.tsx",
      "apps/production/src/App.ts",
    ]) {
      expect(() => parseSourceProjectConfig({
        project: { id: "unsafe", label: "Unsafe" },
        source: { layout },
      })).toThrow("source.layout");
    }
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
          packageRoot: ".",
        },
      },
    })).toMatchObject({
      library: {
        project: {
          checkoutName: "ui",
          packageRoot: ".",
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
    })).toThrow("Unrecognized key(s) in object: 'files'");
    expect(() => parseSourceProjectConfig({
      project: { id: "demo", label: "Demo" },
      slots: [{ id: "content" }],
    })).toThrow(".designspace.ts");
  });

  it("points to the exact invalid field", () => {
    expect(() => parseSourceProjectConfig({
      project: { id: "demo", label: "Demo" },
      devices: { mode: "desktop" },
    })).toThrow("devices.mode: Invalid literal value, expected \"responsive\"");
  });
});
