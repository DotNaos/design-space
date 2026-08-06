import { ProjectList } from "../components/ProjectList";

export function App() {
  return (
    <main className="min-h-screen bg-zinc-950 px-8 py-10 text-zinc-100">
      <header className="mx-auto mb-8 max-w-4xl border-b border-white/10 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-sky-300">Shared implementation</p>
        <h1 className="mt-2 text-3xl font-semibold">Desktop and tablet app root</h1>
      </header>
      <ProjectList />
    </main>
  );
}
