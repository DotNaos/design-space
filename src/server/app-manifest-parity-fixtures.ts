// Copied parity set from DotNaos/project-template@4d39611f2f79a181944c560220ed9afb39e916a4
// packages/config/app-manifest-fixtures.ts, with target-id and length regressions that exercise
// rules already expressed by that version's parser and JSON Schema.
export const validManifestFixture = {
  $schema: "./schema/app-manifest.schema.json",
  version: 1,
  app: { id: "example-app", displayName: "Example App" },
  targets: {
    web: {
      runtime: "react",
      sourceRoot: "clients/web",
      entrypoint: "clients/web/src/main.tsx",
      devices: {
        desktop: { root: { source: "clients/web/src/app.tsx", export: "App" } },
        tablet: { root: { source: "clients/web/src/app.tsx", export: "App" } },
        mobile: { root: { source: "clients/web/src/app.tsx", export: "App" } },
      },
    },
    native: {
      runtime: "react-native",
      sourceRoot: "clients/mobile",
      entrypoint: "clients/mobile/index.ts",
      devices: {
        mobile: { root: { source: "clients/mobile/App.mobile.tsx", export: "default" } },
      },
    },
  },
} as const;

export const appManifestParityFixtures = [
  { name: "valid manifest with schema reference", value: validManifestFixture, valid: true },
  {
    name: "target id ending in a dash",
    value: {
      ...validManifestFixture,
      targets: { "web-": validManifestFixture.targets.web },
    },
    valid: true,
  },
  {
    name: "unbounded canonical string lengths",
    value: {
      ...validManifestFixture,
      app: { id: `a${"b".repeat(160)}`, displayName: "Long display name" },
      targets: {
        web: {
          ...validManifestFixture.targets.web,
          sourceRoot: `clients/${"nested/".repeat(180)}web`,
          entrypoint: `clients/${"nested/".repeat(180)}web/src/main.tsx`,
          devices: {
            desktop: {
              root: { source: `clients/${"nested/".repeat(180)}web/src/App.desktop.tsx`, export: "App" },
            },
          },
        },
      },
    },
    valid: true,
  },
  { name: "non-string schema reference", value: { ...validManifestFixture, $schema: 1 }, valid: false },
  {
    name: "whitespace display name",
    value: { ...validManifestFixture, app: { ...validManifestFixture.app, displayName: "   " } },
    valid: false,
  },
  {
    name: "non-TSX root",
    value: {
      ...validManifestFixture,
      targets: {
        ...validManifestFixture.targets,
        native: {
          ...validManifestFixture.targets.native,
          devices: { mobile: { root: { source: "clients/mobile/App.mobile.ts", export: "default" } } },
        },
      },
    },
    valid: false,
  },
  {
    name: "non-normalized project path",
    value: {
      ...validManifestFixture,
      targets: { web: { ...validManifestFixture.targets.web, sourceRoot: "clients/./web" } },
    },
    valid: false,
  },
] as const;
