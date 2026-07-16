export const DESIGN_SPACE_INSTANCES_PATH = "/__design-space/instances";
export const DESIGN_SPACE_HEALTH_PATH = "/__design-space/health";

export interface RunningDesignSpaceTarget {
  instanceId: string;
  project: { id: string; label: string };
  url: string;
  current: boolean;
}
