import { ProjectList } from "../components/ProjectList";

export function AppDesktop() {
  return (
    <main className="target-style-probe min-h-screen px-8 py-10 text-zinc-100">
      <header className="mx-auto mb-8 max-w-4xl border-b border-white/10 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-sky-300">Web target · Desktop root</p>
        <h1 className="mt-2 text-3xl font-semibold">Separate desktop implementation</h1>
      </header>
      <ProjectList />
    </main>
  );
}
