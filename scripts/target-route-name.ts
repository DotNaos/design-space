export function targetRouteName(projectId: string): string {
  const slug = projectId.toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") || "app";
  return slug === "design-space" ? slug : `${slug}-design-space`;
}
