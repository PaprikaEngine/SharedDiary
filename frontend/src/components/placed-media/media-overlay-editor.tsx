"use client";

import { useCallback } from "react";
import { DraggableMedia, type PlacedMedia } from "./draggable-media";

type Props = {
  media: PlacedMedia[];
  onMediaChange: (media: PlacedMedia[]) => void;
  canvasScale: number;
  /** Selection is owned by the parent so clicking empty canvas (in
   *  DiaryCanvas) can clear it and so the z-index bump on select is
   *  shared with other overlay types. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Fires when the user removes an item. The parent uses it to
   *  delete the file from R2 — media is uploaded eagerly at paste
   *  time, so removal in the composer should clean up the object. */
  onRemove?: (item: PlacedMedia) => void;
  /** When false, media passes pointer events through so a drawing
   *  tool on the canvas below can draw over it. */
  interactive?: boolean;
};

export function MediaOverlayEditor({ media, onMediaChange, canvasScale, selectedId, onSelect, onRemove, interactive = true }: Props) {
  const handleUpdate = useCallback(
    (instanceId: string, updates: Partial<Pick<PlacedMedia, "x" | "y" | "scale" | "rotation">>) => {
      onMediaChange(
        media.map((m) => (m.instanceId === instanceId ? { ...m, ...updates } : m))
      );
    },
    [media, onMediaChange]
  );

  const handleDelete = useCallback(
    (instanceId: string) => {
      const target = media.find((m) => m.instanceId === instanceId);
      if (target) onRemove?.(target);
      onMediaChange(media.filter((m) => m.instanceId !== instanceId));
      if (selectedId === instanceId) onSelect(null);
    },
    [media, onMediaChange, selectedId, onSelect, onRemove]
  );

  return (
    // Root is pointer-events: none so empty space passes clicks through
    // to the draw canvas below. Each DraggableMedia re-enables pointer
    // events for itself.
    <div className="absolute inset-0 pointer-events-none">
      {media.map((m) => (
        <DraggableMedia
          key={m.instanceId}
          media={m}
          canvasScale={canvasScale}
          selected={selectedId === m.instanceId}
          onSelect={() => onSelect(m.instanceId)}
          onUpdate={(updates) => handleUpdate(m.instanceId, updates)}
          onDelete={() => handleDelete(m.instanceId)}
          interactive={interactive}
        />
      ))}
    </div>
  );
}
