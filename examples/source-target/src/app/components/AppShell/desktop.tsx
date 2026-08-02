import type { ComponentSlot, ComponentSlotList } from "../../strict-ui";

export interface AppShellProps {
  slots: {
    notice: ComponentSlot<"StatusNotice">;
    content: ComponentSlot<"GeneratedHome">;
    actions?: ComponentSlotList<"ToolbarAction", 0, 2>;
  };
  children?: never;
}

export function AppShell({ slots }: AppShellProps) {
  return (
    <main style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", padding: 48 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        {slots.notice}
        <div style={{ display: "flex", gap: 8 }}>{slots.actions}</div>
      </header>
      <section style={{ marginTop: 32 }}>{slots.content}</section>
    </main>
  );
}
