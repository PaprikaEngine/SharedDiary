"use client";

import { useState, useCallback } from "react";
import { DraggableStamp, type PlacedStamp } from "./draggable-stamp";

const MAX_STAMPS = 20;

type Props = {
  stamps: PlacedStamp[];
  onStampsChange: (stamps: PlacedStamp[]) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasScale: number;
};

export function StampOverlayEditor({
  stamps,
  onStampsChange,
  canvasScale,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleUpdate = useCallback(
    (instanceId: string, updates: Partial<Pick<PlacedStamp, "x" | "y" | "scale" | "rotation">>) => {
      onStampsChange(
        stamps.map((s) =>
          s.instanceId === instanceId ? { ...s, ...updates } : s
        )
      );
    },
    [stamps, onStampsChange]
  );

  const handleDelete = useCallback(
    (instanceId: string) => {
      onStampsChange(stamps.filter((s) => s.instanceId !== instanceId));
      if (selectedId === instanceId) setSelectedId(null);
    },
    [stamps, onStampsChange, selectedId]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 5 }}
      onClick={handleBackgroundClick}
    >
      {stamps.map((stamp) => (
        <DraggableStamp
          key={stamp.instanceId}
          stamp={stamp}
          canvasScale={canvasScale}
          selected={selectedId === stamp.instanceId}
          onSelect={() => setSelectedId(stamp.instanceId)}
          onUpdate={(updates) => handleUpdate(stamp.instanceId, updates)}
          onDelete={() => handleDelete(stamp.instanceId)}
        />
      ))}

      {/* Stamp count indicator */}
      {stamps.length > 0 && (
        <div className="absolute bottom-2 right-2 bg-white/80 text-xs text-ink-light px-2 py-1 rounded z-30 pointer-events-none">
          {stamps.length}/{MAX_STAMPS}
        </div>
      )}
    </div>
  );
}

export { MAX_STAMPS };
