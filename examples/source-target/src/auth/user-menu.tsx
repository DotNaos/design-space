import { UserButton } from "@clerk/react";

import { isClerkConfigured } from "./clerk-provider";

export function UserMenu() {
  if (!isClerkConfigured()) return null;
  return (
    <div className="flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/5">
      <UserButton />
    </div>
  );
}
