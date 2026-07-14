import { useEffect, useState } from "react";

const MOBILE_VIEWPORT_QUERY = "(max-width: 1023px)";

function isMobileViewport() {
  return typeof window === "undefined"
    || typeof window.matchMedia !== "function"
    || window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

export function useMobileViewport() {
  const [mobile, setMobile] = useState(isMobileViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}
