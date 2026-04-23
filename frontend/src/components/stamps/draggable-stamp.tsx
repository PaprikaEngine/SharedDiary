"use client";

import { useRef, useCallback } from "react";
import { LottieStamp } from "./lottie-stamp";

export type PlacedStamp = {
  instanceId: string;
  stampId: string;
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /** Render order against other placed items (media / flipbook /
   *  stamps). Higher = in front. Assigned from a shared counter that
   *  bumps on add and on select. Not persisted — only used during
   *  composition. */
  z: number;
};

type Props = {
  stamp: PlacedStamp;
  canvasScale: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Pick<PlacedStamp, "x" | "y" | "scale" | "rotation">>) => void;
  onDelete: () => void;
  /** When false, the stamp passes pointer events through so a
   *  drawing tool on the canvas below can draw over it. Parents
   *  flip this based on the current tool. */
  interactive?: boolean;
};

const STAMP_BASE_SIZE = 64;

export function DraggableStamp({
  stamp,
  canvasScale,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  interactive = true,
}: Props) {
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect();

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: stamp.x,
        origY: stamp.y,
      };
    },
    [onSelect, stamp.x, stamp.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      e.preventDefault();

      const dx = (e.clientX - dragStartRef.current.startX) / canvasScale;
      const dy = (e.clientY - dragStartRef.current.startY) / canvasScale;

      onUpdate({
        x: dragStartRef.current.origX + dx,
        y: dragStartRef.current.origY + dy,
      });
    },
    [canvasScale, onUpdate]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragStartRef.current = null;
  }, []);

  const size = STAMP_BASE_SIZE * stamp.scale;
  const displaySize = size * canvasScale;

  return (
    <div
      className="absolute"
      style={{
        left: stamp.x * canvasScale - displaySize / 2,
        top: stamp.y * canvasScale - displaySize / 2,
        width: displaySize,
        height: displaySize,
        transform: `rotate(${stamp.rotation}deg)`,
        zIndex: stamp.z,
        cursor: "grab",
        touchAction: "none",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <LottieStamp
        url={stamp.url}
        width={displaySize}
        height={displaySize}
      />

      {selected && (
        <>
          {/* Selection border */}
          <div className="absolute inset-0 border-2 border-moss border-dashed rounded pointer-events-none" />

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-3 -right-3 w-6 h-6 bg-ink text-cream rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-30"
          >
            &times;
          </button>

          {/* Scale controls */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-30">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ scale: Math.max(0.3, stamp.scale - 0.2) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              &minus;
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ rotation: (stamp.rotation + 15) % 360 });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              &#x21bb;
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ scale: Math.min(3, stamp.scale + 0.2) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  );
}
