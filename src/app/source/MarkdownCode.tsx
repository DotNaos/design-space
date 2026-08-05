import type { ComponentPropsWithoutRef } from "react";

export function MarkdownCode(props: ComponentPropsWithoutRef<"code">) {
  const block = typeof props.className === "string" && props.className.includes("language-");
  if (block) return <code {...props} className={`${props.className} font-mono`} />;
  return (
    <code
      {...props}
      className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.92em] text-sky-200"
    />
  );
}
