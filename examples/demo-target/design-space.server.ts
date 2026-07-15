export const registration = {
  project: { id: "demo-target", label: "Design Space demo target" },
  targetModule: "design-space.config.tsx",
  files: { "card.source": "src/Card.tsx" },
  editTargets: {
    "card.surface": {
      fileId: "card.source",
      marker: "cardSourceClassName = ",
      compiler: "tsx",
    },
  },
};
