import { defineComponentDesign } from "../../../shared/component-design";
import { WorkspaceShell, WorkspaceStatus } from ".";

function WorkspaceContentPreview() {
  return (
    <main className="grid min-h-full place-items-center bg-[#0d0e10] p-8 text-zinc-200">
      <section className="w-full max-w-md border border-white/10 bg-[#141518] p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-300">Content slot</p>
        <h1 className="mt-3 text-xl font-semibold">Workspace content</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          The shell is rendered with a lightweight design fixture instead of starting another Design Space workspace.
        </p>
      </section>
    </main>
  );
}

export default defineComponentDesign(WorkspaceShell, {
  isStateful: false,
  defaults: {
    slots: {
      status: <WorkspaceStatus />,
      content: <WorkspaceContentPreview />,
    },
  },
  designs: { default: {} },
  render: (props) => <WorkspaceShell {...props} />,
});
