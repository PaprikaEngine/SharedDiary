"use client";

import { useCallback } from "react";
import { DraggableBlock, type PlacedBlock } from "./draggable-block";

type Props = {
  blocks: PlacedBlock[];
  onBlocksChange: (blocks: PlacedBlock[]) => void;
  canvasScale: number;
  /** Selection is owned by the parent so clicking empty canvas (in
   *  DiaryCanvas) can clear it and so the z-index bump on select is
   *  shared with other overlay types. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When false, blocks pass pointer events through to the draw
   *  canvas — used while a drawing tool (pen / eraser / tape) is
   *  active so the user can draw over placed items. */
  interactive?: boolean;
};

export function BlockOverlayEditor({
  blocks,
  onBlocksChange,
  canvasScale,
  selectedId,
  onSelect,
  interactive = true,
}: Props) {
  const handleUpdate = useCallback(
    (
      instanceId: string,
      updates: Partial<Pick<PlacedBlock, "x" | "y" | "width" | "rotation" | "data">>
    ) => {
      onBlocksChange(
        blocks.map((b) => (b.instanceId === instanceId ? { ...b, ...updates } : b))
      );
    },
    [blocks, onBlocksChange]
  );

  const handleDelete = useCallback(
    (instanceId: string) => {
      onBlocksChange(blocks.filter((b) => b.instanceId !== instanceId));
      if (selectedId === instanceId) onSelect(null);
    },
    [blocks, onBlocksChange, selectedId, onSelect]
  );

  return (
    // Root passes clicks through to the canvas below; each
    // DraggableBlock re-enables pointer events for itself.
    <div className="absolute inset-0 pointer-events-none">
      {blocks.map((block) => (
        <DraggableBlock
          key={block.instanceId}
          block={block}
          canvasScale={canvasScale}
          selected={selectedId === block.instanceId}
          onSelect={() => onSelect(block.instanceId)}
          onUpdate={(updates) => handleUpdate(block.instanceId, updates)}
          onDelete={() => handleDelete(block.instanceId)}
          interactive={interactive}
        />
      ))}
    </div>
  );
}
