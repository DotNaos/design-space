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
});
