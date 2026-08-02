export type DesignSpaceTheme = "dark" | "light";

const STORAGE_KEY = "design-space.theme";
const CHANGE_EVENT = "design-space-theme-change";

export function currentDesignSpaceTheme(): DesignSpaceTheme {
  if (typeof document !== "undefined") {
    const applied = document.documentElement.dataset.designSpaceTheme;
    if (applied === "dark" || applied === "light") return applied;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      // Theme persistence is optional.
    }
  }
  return "dark";
}

export function applyStoredDesignSpaceTheme() {
  applyDesignSpaceTheme(currentDesignSpaceTheme(), false);
}

export function setDesignSpaceTheme(theme: DesignSpaceTheme) {
  applyDesignSpaceTheme(theme, true);
}

export function subscribeDesignSpaceTheme(listener: (theme: DesignSpaceTheme) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleChange = (event: Event) => listener((event as CustomEvent<DesignSpaceTheme>).detail);
  window.addEventListener(CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(CHANGE_EVENT, handleChange);
}

function applyDesignSpaceTheme(theme: DesignSpaceTheme, persist: boolean) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.designSpaceTheme = theme;
    document.documentElement.style.colorScheme = theme;
  }
  if (persist && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme persistence is optional.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<DesignSpaceTheme>(CHANGE_EVENT, { detail: theme }));
  }
}
