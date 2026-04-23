"use client";

import { useCallback } from "react";
import { DraggableStamp, type PlacedStamp } from "./draggable-stamp";

const MAX_STAMPS = 20;

type Props = {
  stamps: PlacedStamp[];
  onStampsChange: (stamps: PlacedStamp[]) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasScale: number;
  /** Selection is owned by the parent so clicking empty canvas (in
   *  DiaryCanvas) can clear it and so the z-index bump on select is
   *  shared with other overlay types. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When false, stamps pass pointer events through to the draw
   *  canvas — used while a drawing tool (pen / eraser / tape) is
   *  active so the user can draw over placed items. */
  interactive?: boolean;
};

export function StampOverlayEditor({
  stamps,
  onStampsChange,
  canvasScale,
  selectedId,
  onSelect,
  interactive = true,
}: Props) {
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
      if (selectedId === instanceId) onSelect(null);
    },
    [stamps, onStampsChange, selectedId, onSelect]
  );

  return (
    // Root is pointer-events: none so empty space passes clicks through
    // to the draw canvas below. Each DraggableStamp re-enables pointer
    // events for itself.
    <div className="absolute inset-0 pointer-events-none">
      {stamps.map((stamp) => (
        <DraggableStamp
          key={stamp.instanceId}
          stamp={stamp}
          canvasScale={canvasScale}
          selected={selectedId === stamp.instanceId}
          onSelect={() => onSelect(stamp.instanceId)}
          onUpdate={(updates) => handleUpdate(stamp.instanceId, updates)}
          onDelete={() => handleDelete(stamp.instanceId)}
          interactive={interactive}
        />
      ))}

      {/* Stamp count indicator — pinned above every placed item so it
          isn't hidden when a stamp lands on the bottom-right corner. */}
      {stamps.length > 0 && (
        <div
          className="absolute bottom-2 right-2 bg-white/80 text-xs text-ink-light px-2 py-1 rounded pointer-events-none"
          style={{ zIndex: 9999 }}
        >
          {stamps.length}/{MAX_STAMPS}
        </div>
      )}
    </div>
  );
}

export { MAX_STAMPS };
