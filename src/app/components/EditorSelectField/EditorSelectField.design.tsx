import { defineComponentDesign } from "../../../shared/component-design";
import { EditorSelectField } from "./EditorSelectField";

const options = [
  { id: "alpha", value: "alpha", label: "Alpha" },
  { id: "beta", value: "beta", label: "Beta" },
  { id: "disabled", value: "disabled", label: "Unavailable", disabled: true },
];

export default defineComponentDesign(EditorSelectField, {
  isStateful: false,
  defaults: {
    ariaLabel: "Example option",
    density: "regular",
    label: "Option",
    onChange: () => undefined,
    options,
    value: "alpha",
  },
  designs: {
    default: {},
    compact: { density: "compact" },
  },
  render: (props) => <EditorSelectField {...props} />,
});
