import { defineComponentDesign } from "../../../../../../src/shared/component-design";

import { ProjectList } from "./ProjectList";

export default defineComponentDesign(ProjectList, {
  isStateful: false,
  defaults: {},
  designs: { default: {} },
  render: () => <ProjectList />,
});
