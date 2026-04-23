"use client";

import { useRef, useCallback } from "react";

// A placed media item is an image or video positioned freely on the
// 800×600 diary canvas. Mirrors the PlacedStamp shape so the drag/scale
// UX is identical to stamps.
export type PlacedMedia = {
  instanceId: string;
  type: "image" | "video";
  previewUrl: string;       // R2 public URL (uploaded at paste time)
  /** R2 object key, retained so the composer can delete the file if
   *  the user removes the item before submitting. */
  uploadedPath: string;
  // Positioning (canvas-space coordinates, 800×600)
  x: number;                // center x
  y: number;                // center y
  scale: number;            // multiplier on baseWidth
  rotation: number;         // degrees
  baseWidth: number;        // natural display width before scale
  baseHeight: number;       // natural display height before scale
  /** Render order against other placed items (media / flipbook /
   *  stamps). Higher = in front. Assigned from a shared counter that
   *  bumps on add and on select. Not persisted — only used during
   *  composition. */
  z: number;
};

type Props = {
  media: PlacedMedia;
  canvasScale: number;      // 1 = native 800×600, <1 when shrunk to fit
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Pick<PlacedMedia, "x" | "y" | "scale" | "rotation">>) => void;
  onDelete: () => void;
  /** When false, the item passes pointer events through so a drawing
   *  tool on the canvas below can draw over it. */
  interactive?: boolean;
};

export function DraggableMedia({
  media,
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
        origX: media.x,
        origY: media.y,
      };
    },
    [onSelect, media.x, media.y]
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

  const canvasWidth = media.baseWidth * media.scale;
  const canvasHeight = media.baseHeight * media.scale;
  const displayWidth = canvasWidth * canvasScale;
  const displayHeight = canvasHeight * canvasScale;

  return (
    <div
      className="absolute"
      style={{
        left: media.x * canvasScale - displayWidth / 2,
        top: media.y * canvasScale - displayHeight / 2,
        width: displayWidth,
        height: displayHeight,
        transform: `rotate(${media.rotation}deg)`,
        zIndex: media.z,
        cursor: "grab",
        touchAction: "none",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {media.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.previewUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-cover rounded-sm shadow-md select-none pointer-events-none"
        />
      ) : (
        // Muted, non-playing video in the editor — click interactions are
        // for drag/select, not playback. Playback happens in the viewer.
        <video
          src={media.previewUrl}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover rounded-sm shadow-md pointer-events-none"
        />
      )}

      {selected && (
        <>
          <div className="absolute inset-0 border-2 border-moss border-dashed rounded-sm pointer-events-none" />

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

          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-30">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ scale: Math.max(0.3, media.scale - 0.15) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              &minus;
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ rotation: (media.rotation + 15) % 360 });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
            >
              &#x21bb;
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ scale: Math.min(3, media.scale + 0.15) });
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
