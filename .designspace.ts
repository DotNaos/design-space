import { defineDesignSpace } from "./src/shared/source-workspace";

export default defineDesignSpace({
  project: {
    id: "design-space",
    label: "Design Space",
  },
  devices: {
    mode: "responsive",
  },
  source: {
    layout: "src/app/App.tsx",
  },
  library: {
    package: "@dotnaos/react-ui",
    development: process.env.DESIGN_SPACE_UI_LIBRARY_ROOT ? {
      root: process.env.DESIGN_SPACE_UI_LIBRARY_ROOT,
    } : undefined,
  },
});
