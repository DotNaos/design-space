
import { Box, Image, List, MousePointerClick, Type } from "lucide-react";

export function HtmlLayerIcon({ tagName }: { tagName: string }) {
  const normalized = tagName.toLowerCase();
  const iconProps = { "aria-hidden": true, className: "shrink-0 text-zinc-500", "data-layer-icon": `html-${normalized}`, size: 13 } as const;
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "strong", "small"].includes(normalized)) return <Type {...iconProps} />;
  if (["img", "picture", "svg", "canvas"].includes(normalized)) return <Image {...iconProps} />;
  if (["button", "a"].includes(normalized)) return <MousePointerClick {...iconProps} />;
  if (["ul", "ol", "li"].includes(normalized)) return <List {...iconProps} />;
  return <Box {...iconProps} />;
}
