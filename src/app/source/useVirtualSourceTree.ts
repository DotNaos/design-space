import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";

const rowHeight = 40;
const overscanRows = 8;
const virtualizationThreshold = 80;

export interface VirtualSourceTreeWindow {
  anchorDirection?: "above" | "below";
  bottomSpacer: number;
  end: number;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollToSelected: () => void;
  scrollToAnchor: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedDirection?: "above" | "below";
  start: number;
  topSpacer: number;
  virtualized: boolean;
}

export function useVirtualSourceTree(
  rowCount: number,
  selectedIndex: number,
  anchorIndex: number,
): VirtualSourceTreeWindow {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const virtualized = typeof ResizeObserver !== "undefined"
    && rowCount > virtualizationThreshold;

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const update = () => setViewportHeight(scroll.clientHeight);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, []);

  const window = useMemo(() => {
    if (!virtualized || viewportHeight <= 0) {
      return { start: 0, end: rowCount };
    }
    return virtualSourceTreeWindow(rowCount, scrollTop, viewportHeight);
  }, [rowCount, scrollTop, viewportHeight, virtualized]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!virtualized || !scroll || selectedIndex < 0 || viewportHeight <= 0) return;
    const rowTop = selectedIndex * rowHeight;
    const rowBottom = rowTop + rowHeight;
    if (rowTop < scroll.scrollTop) {
      scroll.scrollTop = rowTop;
      setScrollTop(rowTop);
    } else if (rowBottom > scroll.scrollTop + viewportHeight) {
      const next = Math.max(0, rowBottom - viewportHeight);
      scroll.scrollTop = next;
      setScrollTop(next);
    }
  }, [selectedIndex, viewportHeight, virtualized]);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);
  const directions = sourceTreeAnchorDirections(
    anchorIndex,
    selectedIndex,
    scrollTop,
    viewportHeight,
  );
  const scrollToIndex = useCallback((index: number) => {
    const scroll = scrollRef.current;
    if (!scroll || index < 0) return;
    const rowTop = index * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const next = rowTop < scroll.scrollTop
      ? rowTop
      : Math.max(0, rowBottom - scroll.clientHeight);
    scroll.scrollTop = next;
    setScrollTop(next);
  }, []);
  const scrollToAnchor = useCallback(() => scrollToIndex(anchorIndex), [anchorIndex, scrollToIndex]);
  const scrollToSelected = useCallback(() => scrollToIndex(selectedIndex), [scrollToIndex, selectedIndex]);

  return {
    anchorDirection: directions.active,
    bottomSpacer: Math.max(0, (rowCount - window.end) * rowHeight),
    end: window.end,
    onScroll,
    scrollToSelected,
    scrollToAnchor,
    scrollRef,
    selectedDirection: directions.selected,
    start: window.start,
    topSpacer: window.start * rowHeight,
    virtualized,
  };
}

export function sourceTreeAnchorDirections(
  activeIndex: number,
  selectedIndex: number,
  scrollTop: number,
  viewportHeight: number,
): {
  active?: "above" | "below";
  selected?: "above" | "below";
} {
  return {
    active: sourceTreeOffscreenDirection(activeIndex, scrollTop, viewportHeight),
    selected: selectedIndex === activeIndex
      ? undefined
      : sourceTreeOffscreenDirection(selectedIndex, scrollTop, viewportHeight),
  };
}

export function sourceTreeOffscreenDirection(
  index: number,
  scrollTop: number,
  viewportHeight: number,
): "above" | "below" | undefined {
  if (index < 0 || viewportHeight <= 0) return undefined;
  const rowTop = index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowBottom <= scrollTop) return "above";
  if (rowTop >= scrollTop + viewportHeight) return "below";
  return undefined;
}

export function virtualSourceTreeWindow(
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
): { start: number; end: number } {
  const visibleStart = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visibleCount = Math.ceil(Math.max(0, viewportHeight) / rowHeight);
  return {
    start: Math.max(0, visibleStart - overscanRows),
    end: Math.min(rowCount, visibleStart + visibleCount + overscanRows),
  };
}
