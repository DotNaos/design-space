import { Scrollable } from "@dotnaos/react-ui";
import { readAppStatus, type AppStatus } from "@project-design-space-target-daa2facd/client";
import { Activity, Boxes, CheckCircle2, Cpu, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthShell } from "./auth/auth-shell";
import { UserMenu } from "./auth/user-menu";

const modules = [
  { icon: Boxes, label: "Workspace", value: "Bun + Turbo" },
  { icon: Activity, label: "Frontend", value: "React + DotNaos UI" },
  { icon: Cpu, label: "Backend", value: "Go API" },
  { icon: Smartphone, label: "Mobile", value: "React Native path" },
];

const projectDisplayName = "Project Design Space Target Daa2facd";

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";

  useEffect(() => {
    void readAppStatus({ baseUrl: apiBaseUrl }).then(setStatus);
  }, [apiBaseUrl]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <p className="text-sm text-zinc-400">{projectDisplayName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">{projectDisplayName}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <AuthShell />
            <UserMenu />
            <div className="flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              <CheckCircle2 className="size-4" />
              Ready for sync
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center gap-6">
            <p className="max-w-2xl text-lg leading-8 text-zinc-300">
              This project was generated from the fullstack template: web, mobile path, Go backend,
              CLI, checks, CI, and template metadata in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200" href={`${apiBaseUrl}/health`}>
                Check API health
              </a>
              <a className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10" href="https://github.com/DotNaos/project-design-space-target-daa2facd" rel="noreferrer" target="_blank">
                Open repo
              </a>
            </div>
          </div>

          <Scrollable className="max-h-[420px] rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <div className="flex items-center justify-between rounded-md border border-white/10 bg-zinc-900 px-4 py-3" key={module.label}>
                    <div className="flex items-center gap-3">
                      <Icon className="size-5 text-sky-300" />
                      <span className="font-medium">{module.label}</span>
                    </div>
                    <span className="text-sm text-zinc-400">{module.value}</span>
                  </div>
                );
              })}
            </div>
          </Scrollable>
        </div>

        <footer className="mt-auto rounded-lg border border-white/10 bg-zinc-900/80 p-4 text-sm text-zinc-300">
          Backend status:{" "}
          <span className="font-medium text-white">
            {status ? `${status.name} ${status.version} (${status.environment})` : "loading"}
          </span>
        </footer>
      </section>
    </main>
  );
}
