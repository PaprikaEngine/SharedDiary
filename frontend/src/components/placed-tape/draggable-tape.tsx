"use client";

import { useRef, useCallback } from "react";
import { TAPES, TAPE_ALPHA, type TapeId } from "@/components/diary-canvas/tape-patterns";

// A placed masking-tape piece on the diary canvas. Mirrors the
// (x, y, scale, rotation) shape of placed stamps and media — except
// tapes have a fixed thickness (the tile's natural height) so they
// expose `length` instead of a uniform `scale`. The thickness is
// looked up from the runtime TAPES registry, not stored here.
export type PlacedTape = {
  instanceId: string;
  tapeId: TapeId;
  /** Canvas-space center coordinates. */
  x: number;
  y: number;
  /** Length along the tape's long axis (canvas-space px). */
  length: number;
  /** Degrees, mirroring stamps. */
  rotation: number;
  /** Render order against other placed items. Not persisted. */
  z: number;
};

type Props = {
  tape: PlacedTape;
  canvasScale: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Pick<PlacedTape, "x" | "y" | "length" | "rotation">>) => void;
  onDelete: () => void;
  /** When false, the tape passes pointer events through so a drawing
   *  tool on the canvas below can draw over it. */
  interactive?: boolean;
};

/** Minimum length so +/− buttons can't shrink a tape to zero. */
const MIN_LENGTH = 32;
/** Cap so a runaway long-press on `+` doesn't grow tape off-canvas. */
const MAX_LENGTH = 1200;
/** Each `+` / `−` press changes length by this many canvas pixels. */
const LENGTH_STEP = 20;

export function DraggableTape({
  tape,
  canvasScale,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  interactive = true,
}: Props) {
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const def = TAPES[tape.tapeId];
  // Thickness in canvas-space. Falls back to a sane default if the
  // tile registry hasn't registered this tape yet (group tape still
  // loading — should resolve once load completes).
  const thickness = def?.width ?? 36;
  const tileUrl = def?.tile?.toDataURL();

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
        origX: tape.x,
        origY: tape.y,
      };
    },
    [onSelect, tape.x, tape.y]
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

  const displayLength = tape.length * canvasScale;
  const displayThickness = thickness * canvasScale;

  return (
    <div
      className="absolute"
      style={{
        // Center the tape rectangle on (x, y) before rotating.
        left: tape.x * canvasScale - displayLength / 2,
        top: tape.y * canvasScale - displayThickness / 2,
        width: displayLength,
        height: displayThickness,
        transform: `rotate(${tape.rotation}deg)`,
        zIndex: tape.z,
        cursor: "grab",
        touchAction: "none",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Tape body — pattern-tiled background mirrors the canvas-pixel
          rendering used in Phase 1, including the soft alpha so the
          tape reads as washi rather than solid color. */}
      <div
        className="w-full h-full pointer-events-none"
        style={{
          backgroundImage: tileUrl ? `url(${tileUrl})` : undefined,
          backgroundColor: tileUrl ? undefined : (def?.preview ?? "#E5A6A6"),
          backgroundRepeat: "repeat",
          backgroundSize: "auto 100%",
          opacity: TAPE_ALPHA,
          // Soft top/bottom shadow lines fake the "stuck on paper" look,
          // matching the canvas-pixel renderer in diary-canvas.tsx.
          boxShadow: "inset 0 1px 0 rgba(0,0,0,0.18), inset 0 -1px 0 rgba(0,0,0,0.18)",
        }}
      />

      {selected && (
        <>
          {/* Selection outline. Sits inside the rotated frame so it
              matches the tape's orientation, just like stamps. */}
          <div className="absolute inset-0 border-2 border-moss border-dashed pointer-events-none" />

          {/* Delete. See draggable-stamp.tsx for the pointerdown
              stopPropagation rationale — without it, the parent's
              preventDefault on pointerdown kills the click event. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-3 -right-3 w-6 h-6 bg-ink text-cream rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-30"
          >
            &times;
          </button>

          {/* Length / rotate controls — anchored just below the tape
              so they stay readable even when a long tape lies near
              the bottom edge. */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-30">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ length: Math.max(MIN_LENGTH, tape.length - LENGTH_STEP) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
              title="短くする"
            >
              &minus;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ rotation: (tape.rotation + 15) % 360 });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
              title="回転"
            >
              &#x21bb;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ length: Math.min(MAX_LENGTH, tape.length + LENGTH_STEP) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
              title="長くする"
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  );
}
