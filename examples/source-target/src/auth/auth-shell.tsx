import { SignInButton, SignUpButton, useAuth } from "@clerk/react";

import { isClerkConfigured } from "./clerk-provider";

export function AuthShell() {
  if (!isClerkConfigured()) {
    return (
      <div className="rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
        Clerk is not configured for this environment.
      </div>
    );
  }
  return <ConfiguredAuthShell />;
}

function ConfiguredAuthShell() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSignedIn ? (
        <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
          Signed in
        </span>
      ) : (
        <>
          <SignInButton mode="modal">
            <button className="rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md border border-white/15 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10">Create account</button>
          </SignUpButton>
        </>
      )}
    </div>
  );
}
