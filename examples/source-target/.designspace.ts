export default {
  project: { id: "generated-project-template-web", label: "Generated Project Template Web" },
  tablet: { fallback: "desktop" },
  library: {
    package: "@dotnaos/react-ui",
    development: process.env.DESIGN_SPACE_UI_LIBRARY_ROOT ? {
      root: process.env.DESIGN_SPACE_UI_LIBRARY_ROOT,
      command: ["bun", "run", "dev"],
      portlessName: "dotnaos-ui-storybook",
    } : undefined,
  },
};
