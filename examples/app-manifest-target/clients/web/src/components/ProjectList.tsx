export function ProjectList() {
  return (
    <section className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
      <article className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="font-medium">Design system</h2>
        <p className="mt-2 text-sm text-zinc-400">Explicitly selected by both web devices.</p>
      </article>
      <article className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="font-medium">Native client</h2>
        <p className="mt-2 text-sm text-zinc-400">Lives under its own target and mobile device.</p>
      </article>
    </section>
  );
}
