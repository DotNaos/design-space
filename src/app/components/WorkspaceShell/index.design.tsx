import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceShell } from ".";

function WorkspaceShellSlotPreview(props: {
  description: string;
  minHeight: number;
  name: "status" | "content" | "toolbar";
}) {
  return (
    <section
      aria-label={`${props.name} slot`}
      data-design-space-source-slot-name={props.name}
      style={{
        alignItems: "center",
        background: "rgba(124, 58, 237, 0.08)",
        backgroundImage: "linear-gradient(45deg, rgba(196, 181, 253, 0.04) 25%, transparent 25%, transparent 75%, rgba(196, 181, 253, 0.04) 75%), linear-gradient(45deg, rgba(196, 181, 253, 0.04) 25%, transparent 25%, transparent 75%, rgba(196, 181, 253, 0.04) 75%)",
        backgroundPosition: "0 0, 12px 12px",
        backgroundSize: "24px 24px",
        border: "1px dashed rgba(167, 139, 250, 0.45)",
        borderRadius: 10,
        boxSizing: "border-box",
        color: "#c4b5fd",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        justifyContent: "center",
        marginTop: props.name === "status" ? 0 : 12,
        minHeight: props.minHeight,
        width: "100%",
      }}
    >
      <strong style={{ font: "600 12px/1.4 ui-monospace, SFMono-Regular, monospace" }}>{props.name}</strong>
      <span style={{ color: "#71717a", font: "10px/1.4 ui-sans-serif, system-ui, sans-serif" }}>{props.description}</span>
    </section>
  );
}

export default defineComponentDesign(WorkspaceShell, {
  isStateful: false,
  preview: {
    background: "#0d0f12",
    height: 640,
    layout: "start",
    padding: 16,
    width: 960,
  },
  defaults: {
    slots: {
      status: <WorkspaceShellSlotPreview name="status" description="Workspace state and connectivity" minHeight={64} /> as never,
      content: <WorkspaceShellSlotPreview name="content" description="Primary workspace surface" minHeight={440} /> as never,
      toolbar: [<WorkspaceShellSlotPreview key="toolbar" name="toolbar" description="Optional workspace actions" minHeight={72} />] as never,
    },
  },
  designs: { default: {} },
  render: (props) => <WorkspaceShell {...props} />,
});
