import { defineComponentDesign } from "../../shared/component-design";
import { ProjectFileBrowser } from "./ProjectFileBrowser";

const files = [
  { id: "src", kind: "directory" as const, label: "src" },
  { id: "app", kind: "directory" as const, label: "app", parentId: "src" },
  { id: "entry", kind: "file" as const, label: "App.tsx", parentId: "app", editable: true },
];

export default defineComponentDesign(ProjectFileBrowser, {
  isStateful: true,
  initialState: "empty",
  defaults: {
    className: "flex h-full w-full",
    files: [],
    onSelect: () => undefined,
  },
  states: {
    empty: {},
    populated: { files },
    selected: { files, selectedFileId: "entry" },
  },
  render: (props) => <ProjectFileBrowser {...props} />,
});
