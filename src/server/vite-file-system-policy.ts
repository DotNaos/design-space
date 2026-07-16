export const DESIGN_SPACE_FILE_SYSTEM_DENY = Object.freeze([
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
  "**/.github/**",
  "**/@tailwindcss/language-server/**",
  "**/design-space.server.*",
  "**/src/server/**",
  "**/vite.config.*",
  "**/package.json",
  "**/bun.lock*",
  "**/tsconfig*.json",
]);

export function createViteFileSystemPolicy(root: string, targetModulePath: string, targetRoot?: string) {
  return {
    strict: true,
    allow: [...new Set([root, targetModulePath, targetRoot].filter((path): path is string => Boolean(path)))],
    deny: [...DESIGN_SPACE_FILE_SYSTEM_DENY],
  };
}
