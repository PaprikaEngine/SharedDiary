"use client";

import { useCallback, useRef } from "react";
import { getBlockTemplate, type BlockField } from "./block-templates";

// A placed profile-book block on the diary canvas. Mirrors the
// (x, y, rotation, z) shape of stamps/tape — except the inner content
// is structured form fields rather than an image, and `width` replaces
// `scale` because text doesn't gracefully resize via CSS scaling.
export type PlacedBlock = {
  instanceId: string;
  blockType: string;
  /** Canvas-space center coordinates. */
  x: number;
  y: number;
  /** Canvas-space width. Height auto-grows from content. */
  width: number;
  /** Degrees, mirroring stamps. v1 ships without rotation UI but the
   *  field is stored so the schema can grow without a migration. */
  rotation: number;
  /** Field key → string value. Persisted as jsonb. */
  data: Record<string, string>;
  /** Render order against other placed items. Not persisted. */
  z: number;
};

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const WIDTH_STEP = 40;

type Props = {
  block: PlacedBlock;
  canvasScale: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Pick<PlacedBlock, "x" | "y" | "width" | "rotation" | "data">>) => void;
  onDelete: () => void;
  /** When false, the block passes pointer events through so a drawing
   *  tool on the canvas below can draw over it. */
  interactive?: boolean;
};

export function DraggableBlock({
  block,
  canvasScale,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  interactive = true,
}: Props) {
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const template = getBlockTemplate(block.blockType);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Always stop propagation so the canvas below doesn't clear
      // the selection (or worse, start drawing) while the user is
      // interacting with this block.
      e.stopPropagation();

      const target = e.target as HTMLElement;
      // Inputs, textareas, and buttons handle their own pointerdown —
      // letting the wrapper preventDefault would kill input focus and
      // button clicks. We still bump selection so the block's outline
      // appears when fields are tapped.
      if (
        target.matches("input, textarea, button, [data-no-drag]") ||
        target.closest("input, textarea, button, [data-no-drag]")
      ) {
        onSelect();
        return;
      }

      e.preventDefault();
      onSelect();

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: block.x,
        origY: block.y,
      };
    },
    [onSelect, block.x, block.y]
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

  if (!template) return null;

  const handleFieldChange = (key: string, value: string) => {
    onUpdate({ data: { ...block.data, [key]: value } });
  };

  const displayWidth = block.width * canvasScale;

  return (
    <div
      className="absolute"
      style={{
        // Position the block by its center via translate(-50%, -50%)
        // — keeps the drag math identical to stamps while letting
        // height auto-grow from content.
        left: block.x * canvasScale,
        top: block.y * canvasScale,
        width: displayWidth,
        transform: `translate(-50%, -50%) rotate(${block.rotation}deg)`,
        zIndex: block.z,
        cursor: "grab",
        touchAction: "none",
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="rounded-lg border bg-white/95 shadow-sm overflow-hidden"
        style={{ borderColor: "var(--stroke)" }}
      >
        <div
          className="px-3 py-2 border-b font-medium t-hi"
          style={{
            borderColor: "var(--stroke)",
            background: "var(--paper-alt)",
            fontSize: 13 * canvasScale,
          }}
        >
          {template.title}
        </div>
        <div
          className="px-3 py-3 flex flex-col gap-2.5"
          style={{ fontSize: 13 * canvasScale }}
        >
          {template.fields.map((f) => (
            <BlockFieldInput
              key={f.key}
              field={f}
              value={block.data[f.key] ?? ""}
              onChange={(v) => handleFieldChange(f.key, v)}
              canvasScale={canvasScale}
              readOnly={!interactive}
            />
          ))}
        </div>
      </div>

      {selected && (
        <>
          <div
            className="absolute inset-0 border-2 border-moss border-dashed rounded-lg pointer-events-none"
          />

          {/* Delete. See draggable-stamp.tsx for the pointerdown
              stopPropagation rationale — without it, the parent's
              preventDefault on pointerdown kills the click event. */}
          <button
            type="button"
            data-no-drag
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-3 -right-3 w-6 h-6 bg-ink text-cream rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-30"
          >
            &times;
          </button>

          {/* Width adjust — sits below the block so a tall message
              block doesn't push the controls off the bottom edge. */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-30">
            <button
              type="button"
              data-no-drag
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ width: Math.max(MIN_WIDTH, block.width - WIDTH_STEP) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
              title="幅を狭める"
            >
              &minus;
            </button>
            <button
              type="button"
              data-no-drag
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ width: Math.min(MAX_WIDTH, block.width + WIDTH_STEP) });
              }}
              className="w-6 h-6 bg-white border border-cream-dark rounded text-xs flex items-center justify-center hover:bg-cream-dark"
              title="幅を広げる"
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BlockFieldInput({
  field,
  value,
  onChange,
  canvasScale,
  readOnly,
}: {
  field: BlockField;
  value: string;
  onChange: (v: string) => void;
  canvasScale: number;
  readOnly: boolean;
}) {
  const labelStyle = {
    fontSize: 11 * canvasScale,
    color: "var(--ink-3, var(--ink-2))",
  } as const;

  if (field.big) {
    return (
      <div className="flex flex-col gap-1">
        {field.label && (
          <span className="t-lo" style={labelStyle}>
            {field.label}
          </span>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          readOnly={readOnly}
          rows={field.tall ? 4 : 2}
          className="w-full resize-none rounded border border-dashed px-2 py-1.5 outline-none bg-transparent focus:bg-white"
          style={{
            borderColor: "var(--stroke)",
            fontSize: 13 * canvasScale,
            lineHeight: 1.6,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2">
      {field.label && (
        <span
          className="t-lo whitespace-nowrap shrink-0"
          style={{ ...labelStyle, minWidth: 78 * canvasScale }}
        >
          {field.label}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        readOnly={readOnly}
        className="flex-1 min-w-0 outline-none border-b border-dotted bg-transparent px-0.5 py-0.5"
        style={{
          borderColor: "var(--stroke)",
          fontSize: 13 * canvasScale,
        }}
      />
    </div>
  );
}
