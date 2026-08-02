import { GeneratedHome } from "./pages/GeneratedHome";
import { AppShell } from "../components/AppShell/desktop";

export default function DesktopLayout() {
  return (
    <AppShell slots={{
      notice: undefined as never,
      content: <GeneratedHome />,
    }} />
  );
}
