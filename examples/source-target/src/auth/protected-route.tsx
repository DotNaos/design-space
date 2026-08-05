
import type { ReactNode } from "react";

import { isClerkConfigured } from "./clerk-provider";
import { ConfiguredProtectedRoute } from "./ConfiguredProtectedRoute";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  return <ConfiguredProtectedRoute>{children}</ConfiguredProtectedRoute>;
}
