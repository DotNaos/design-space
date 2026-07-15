import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && typeof globalThis.ResizeObserver === "undefined") {
  class TestResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
}

if (typeof window !== "undefined" && typeof Element.prototype.getAnimations !== "function") {
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
}

// Node 25 exposes an incomplete experimental localStorage when no backing file is
// configured. Vitest can copy it over jsdom's implementation, so restore the
// browser contract for UI tests when that happens.
if (typeof window !== "undefined" && typeof window.localStorage?.clear !== "function") {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}
