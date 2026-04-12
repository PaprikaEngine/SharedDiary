"use client";

import { useState, useCallback } from "react";
import { DraggableMedia, type PlacedMedia } from "./draggable-media";

type Props = {
  media: PlacedMedia[];
  onMediaChange: (media: PlacedMedia[]) => void;
  canvasScale: number;
};

export function MediaOverlayEditor({ media, onMediaChange, canvasScale }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      if (target?.file && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      onMediaChange(media.filter((m) => m.instanceId !== instanceId));
      if (selectedId === instanceId) setSelectedId(null);
    },
    [media, onMediaChange, selectedId]
  );

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 4 }}
      onClick={() => setSelectedId(null)}
    >
      {media.map((m) => (
        <DraggableMedia
          key={m.instanceId}
          media={m}
          canvasScale={canvasScale}
          selected={selectedId === m.instanceId}
          onSelect={() => setSelectedId(m.instanceId)}
          onUpdate={(updates) => handleUpdate(m.instanceId, updates)}
          onDelete={() => handleDelete(m.instanceId)}
        />
      ))}
    </div>
  );
}
