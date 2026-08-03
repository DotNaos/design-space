import { RedirectToSignIn, useAuth } from "@clerk/react";
import type { ReactNode } from "react";

export function ConfiguredProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;
  return <>{children}</>;
}
