import { ProjectList } from "../components/ProjectList";

export function AppTablet() {
  return (
    <main className="target-style-probe min-h-screen px-6 py-8 text-zinc-100">
      <header className="mx-auto mb-6 max-w-3xl border-b border-white/10 pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">Web target · Tablet root</p>
        <h1 className="mt-2 text-2xl font-semibold">Separate tablet implementation</h1>
      </header>
      <ProjectList />
    </main>
  );
}
