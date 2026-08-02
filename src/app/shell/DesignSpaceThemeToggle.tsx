import { Button, Tooltip } from "@heroui/react";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  currentDesignSpaceTheme,
  setDesignSpaceTheme,
  subscribeDesignSpaceTheme,
  type DesignSpaceTheme,
} from "./design-space-theme";

export function DesignSpaceThemeToggle() {
  const [theme, setTheme] = useState<DesignSpaceTheme>(currentDesignSpaceTheme);
  useEffect(() => subscribeDesignSpaceTheme(setTheme), []);
  const next = theme === "dark" ? "light" : "dark";
  const label = `Switch Design Space to ${next} theme`;

  return (
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-label={label}
        className="size-8 min-w-8 rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
        size="sm"
        variant="ghost"
        onPress={() => setDesignSpaceTheme(next)}
      >
        {theme === "dark" ? <Sun aria-hidden="true" size={14} /> : <Moon aria-hidden="true" size={14} />}
      </Button>
      <Tooltip.Content className="rounded-lg border-0 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {label}
      </Tooltip.Content>
    </Tooltip>
  );
}
