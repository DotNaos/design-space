import { defineComponentDesign } from "../../../../../../src/shared/component-design";

import { ProjectSummary } from "./desktop";

export default defineComponentDesign(ProjectSummary, {
  isStateful: false,
  defaults: { label: "Project Space", ready: false },
  designs: {
    default: {},
    ready: { ready: true },
  },
  render: (props) => <ProjectSummary {...props} />,
});
