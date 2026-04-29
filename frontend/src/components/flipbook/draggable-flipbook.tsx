"use client";

import { useRef, useCallback } from "react";
import { BookOpen, Pencil } from "lucide-react";

// A placed flipbook on the diary canvas — same (x, y, scale, rotation,
// baseWidth, baseHeight) shape as placed media and stamps so the drag/
// scale UX is consistent.
export type PlacedFlipbook = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  baseWidth: number;
  baseHeight: number;
  /** First frame as a data URL, used as a static preview in the editor.
   *  Null while the flipbook has no frames yet. */
  previewDataUrl: string | null;
  /** Render order against other placed items (media / flipbook /
   *  stamps). Higher = in front. Assigned from a shared counter that
   *  bumps on add and on select. Not persisted — only used during
   *  composition. */
  z: number;
};

type Props = {
  flipbook: PlacedFlipbook;
  canvasScale: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Pick<PlacedFlipbook, "x" | "y" | "scale" | "rotation">>) => void;
  onEdit: () => void;
  onDelete: () => void;
  /** When false, the flipbook passes pointer events through so a
   *  drawing tool on the canvas below can draw over it. */
  interactive?: boolean;
};

export function DraggableFlipbook({
  flipbook,
  canvasScale,
  selected,
  onSelect,
  onUpdate,
  onEdit,
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
        origX: flipbook.x,
        origY: flipbook.y,
      };
    },
    [onSelect, flipbook.x, flipbook.y]
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

  const canvasWidth = flipbook.baseWidth * flipbook.scale;
  const canvasHeight = flipbook.baseHeight * flipbook.scale;
  const displayWidth = canvasWidth * canvasScale;
  const displayHeight = canvasHeight * canvasScale;

  return (
    <div
      className="absolute"
      style={{
        left: flipbook.x * canvasScale - displayWidth / 2,
        top: flipbook.y * canvasScale - displayHeight / 2,
        width: displayWidth,
        height: displayHeight,
        transform: `rotate(${flipbook.rotation}deg)`,
        zIndex: flipbook.z,
        cursor: "grab",
        touchAction: "none",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {flipbook.previewDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flipbook.previewDataUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-cover rounded-sm shadow-md border border-cream-dark/60 bg-white select-none pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white rounded-sm shadow-md border border-cream-dark/60 pointer-events-none">
          <BookOpen className="size-6 text-moss/60" />
        </div>
      )}

      {/* Small animated badge to hint that this is a flipbook */}
      <div className="absolute top-1 left-1 bg-ink/70 text-cream text-[9px] px-1 py-0.5 rounded pointer-events-none">
        パラパラ
      </div>

      {selected && (
        <>
          <div className="absolute inset-0 border-2 border-moss border-dashed rounded-sm pointer-events-none" />

          {/* See draggable-stamp.tsx for the rationale on
              onPointerDown stopPropagation — parent's preventDefault on
              pointerdown otherwise kills the click event on these
              action buttons. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute -top-3 -right-3 w-6 h-6 bg-ink text-cream rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-30"
          >
            &times;
          </button>

          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-30">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ scale: Math.max(0.3, flipbook.scale - 0.15) }); }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              &minus;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ rotation: (flipbook.rotation + 15) % 360 }); }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              &#x21bb;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ scale: Math.min(3, flipbook.scale + 0.15) }); }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              +
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-6 h-6 bg-moss text-white border border-moss rounded text-xs flex items-center justify-center hover:bg-moss-dark"
              title="編集"
            >
              <Pencil className="size-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
