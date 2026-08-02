import { useEffect, useState } from "react";

import { DESIGN_SPACE_INSTANCES_PATH, type RunningDesignSpaceTarget } from "../shared/running-targets";

export function useRunningTargets(): readonly RunningDesignSpaceTarget[] {
  const [targets, setTargets] = useState<readonly RunningDesignSpaceTarget[]>([]);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const response = await fetch(DESIGN_SPACE_INSTANCES_PATH, { headers: { accept: "application/json" } });
        const payload = await response.json() as { instances?: readonly RunningDesignSpaceTarget[] };
        if (!disposed && response.ok && Array.isArray(payload.instances)) setTargets(payload.instances);
      } catch {
        if (!disposed) setTargets([]);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 3_000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);
  return targets;
}
