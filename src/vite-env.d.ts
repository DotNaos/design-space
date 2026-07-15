/// <reference types="vite/client" />

declare module "virtual:design-space-target" {
  const target: import("./shared/target-module").TargetModule;
  export default target;
}
