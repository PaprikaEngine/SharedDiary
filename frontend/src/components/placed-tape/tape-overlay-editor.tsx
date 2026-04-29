"use client";

import { useCallback } from "react";
import { DraggableTape, type PlacedTape } from "./draggable-tape";

type Props = {
  tapes: PlacedTape[];
  onTapesChange: (tapes: PlacedTape[]) => void;
  canvasScale: number;
  /** Selection is owned by the parent so clicking empty canvas (in
   *  DiaryCanvas) can clear it and so the z-index bump on select is
   *  shared with other overlay types. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When false, tapes pass pointer events through to the draw
   *  canvas — used while a drawing tool (pen / eraser / tape) is
   *  active so the user can draw over placed items. */
  interactive?: boolean;
};

export function TapeOverlayEditor({
  tapes,
  onTapesChange,
  canvasScale,
  selectedId,
  onSelect,
  interactive = true,
}: Props) {
  const handleUpdate = useCallback(
    (instanceId: string, updates: Partial<Pick<PlacedTape, "x" | "y" | "length" | "rotation">>) => {
      onTapesChange(
        tapes.map((t) =>
          t.instanceId === instanceId ? { ...t, ...updates } : t
        )
      );
    },
    [tapes, onTapesChange]
  );

  const handleDelete = useCallback(
    (instanceId: string) => {
      onTapesChange(tapes.filter((t) => t.instanceId !== instanceId));
      if (selectedId === instanceId) onSelect(null);
    },
    [tapes, onTapesChange, selectedId, onSelect]
  );

  return (
    // Root is pointer-events: none so empty space passes clicks through
    // to the draw canvas below. Each DraggableTape re-enables pointer
    // events for itself.
    <div className="absolute inset-0 pointer-events-none">
      {tapes.map((tape) => (
        <DraggableTape
          key={tape.instanceId}
          tape={tape}
          canvasScale={canvasScale}
          selected={selectedId === tape.instanceId}
          onSelect={() => onSelect(tape.instanceId)}
          onUpdate={(updates) => handleUpdate(tape.instanceId, updates)}
          onDelete={() => handleDelete(tape.instanceId)}
          interactive={interactive}
        />
      ))}
    </div>
  );
}
