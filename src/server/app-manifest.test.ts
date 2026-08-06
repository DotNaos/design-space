import { describe, expect, it } from "vitest";

import { parseAppManifest } from "./app-manifest";

const manifest = {
  version: 1,
  app: { id: "sample-app", displayName: "Sample App" },
  targets: {
    web: {
      runtime: "react",
      sourceRoot: "clients/web",
      entrypoint: "clients/web/src/main.tsx",
      devices: {
        desktop: { root: { source: "clients/web/src/app-roots/App.tsx", export: "App" } },
        tablet: { root: { source: "clients/web/src/app-roots/App.tsx", export: "App" } },
      },
    },
    native: {
      runtime: "react-native",
      sourceRoot: "clients/mobile",
      entrypoint: "clients/mobile/index.ts",
      devices: {
        mobile: { root: { source: "clients/mobile/src/app-roots/App.mobile.tsx", export: "default" } },
      },
    },
  },
} as const;

describe("app.manifest.json v1", () => {
  it("accepts technical targets and keeps only declared devices", () => {
    const parsed = parseAppManifest(manifest);
    expect(Object.keys(parsed.targets.web!.devices)).toEqual(["desktop", "tablet"]);
    expect(Object.keys(parsed.targets.native!.devices)).toEqual(["mobile"]);
  });

  it("accepts electron as a technical runtime", () => {
    expect(parseAppManifest({
      ...manifest,
      targets: {
        desktop: {
          runtime: "electron",
          sourceRoot: "clients/desktop",
          entrypoint: "clients/desktop/src/main.ts",
          devices: {
            desktop: { root: { source: "clients/desktop/src/App.desktop.tsx", export: "AppDesktop" } },
          },
        },
      },
    }).targets.desktop?.runtime).toBe("electron");
  });

  it("fails closed for undeclared fields, traversal, and empty devices", () => {
    expect(() => parseAppManifest({ ...manifest, lanes: {} })).toThrow("app.manifest.json is invalid");
    expect(() => parseAppManifest({
      ...manifest,
      targets: { web: { ...manifest.targets.web, sourceRoot: "../web" } },
    })).toThrow("normalized project-relative path");
    expect(() => parseAppManifest({
      ...manifest,
      targets: { web: { ...manifest.targets.web, devices: {} } },
    })).toThrow("Declare at least one device");
  });

  it("requires explicit neutral naming for shared roots", () => {
    expect(() => parseAppManifest({
      ...manifest,
      targets: {
        web: {
          ...manifest.targets.web,
          devices: {
            desktop: { root: { source: "clients/web/src/App.desktop.tsx", export: "App" } },
            tablet: { root: { source: "clients/web/src/App.desktop.tsx", export: "App" } },
          },
        },
      },
    })).toThrow("device-neutral filename");
  });
});
