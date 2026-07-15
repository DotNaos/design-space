import { useRef, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasCamera } from "../canvas-transform";
import { useCanvasTrackpadGestures } from "./use-canvas-trackpad-gestures";

afterEach(cleanup);

describe("useCanvasTrackpadGestures", () => {
  it("turns an ordinary trackpad wheel into canvas pan and cancels browser handling", () => {
    const onInteraction = vi.fn();
    render(<Harness onInteraction={onInteraction} />);
    const viewport = screen.getByTestId("viewport");
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaX: 12,
      deltaY: 18,
    });

    act(() => viewport.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId("camera")).toHaveTextContent("4,38,1");
    expect(onInteraction).toHaveBeenCalledOnce();
  });

  it("owns ctrl-wheel pinch zoom instead of allowing page zoom", () => {
    render(<Harness onInteraction={() => undefined} />);
    const viewport = screen.getByTestId("viewport");
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 80,
      ctrlKey: true,
      deltaY: -10,
    });

    act(() => viewport.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(camera().scale).toBeCloseTo(Math.exp(0.1));
  });

  it("keeps a moving Safari pinch centroid attached to the same world point", () => {
    render(<Harness onInteraction={() => undefined} />);
    const viewport = screen.getByTestId("viewport");

    act(() => {
      viewport.dispatchEvent(gestureEvent("gesturestart", 1, 100, 100));
      viewport.dispatchEvent(gestureEvent("gesturechange", 2, 120, 110));
    });

    expect(camera()).toEqual({ x: -48, y: 22, scale: 2 });
  });

  it("leaves wheel scrolling to the rendered target in interact mode", () => {
    render(<Harness enabled={false} onInteraction={() => undefined} />);
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 24 });

    act(() => screen.getByTestId("viewport").dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(camera()).toEqual({ x: 16, y: 56, scale: 1 });
  });
});

function Harness(props: { enabled?: boolean; onInteraction: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<CanvasCamera>({ x: 16, y: 56, scale: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  useCanvasTrackpadGestures({ enabled: props.enabled ?? true, viewportRef, cameraRef, setCamera, onInteraction: props.onInteraction });
  return (
    <div ref={viewportRef} data-testid="viewport">
      <output data-testid="camera">{camera.x},{camera.y},{camera.scale}</output>
    </div>
  );
}

function gestureEvent(type: string, scale: number, clientX: number, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    scale: { value: scale },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

function camera(): CanvasCamera {
  const [x, y, scale] = screen.getByTestId("camera").textContent!.split(",").map(Number);
  return { x, y, scale };
}
