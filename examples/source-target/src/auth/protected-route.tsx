import { RedirectToSignIn, useAuth } from "@clerk/react";
import type { ReactNode } from "react";

import { isClerkConfigured } from "./clerk-provider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  return <ConfiguredProtectedRoute>{children}</ConfiguredProtectedRoute>;
}

function ConfiguredProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;
  return <>{children}</>;
}
