

import { isClerkConfigured } from "./clerk-provider";
import { ConfiguredAuthShell } from "./ConfiguredAuthShell";

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
