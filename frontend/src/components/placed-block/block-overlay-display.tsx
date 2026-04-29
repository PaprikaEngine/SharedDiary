"use client";

import { getBlockTemplate } from "./block-templates";

// Read-only block as it comes back from the database — the composer's
// PlacedBlock minus the runtime-only `z` and `instanceId` fields.
export type BlockDisplayData = {
  id: string;
  block_type: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  data: Record<string, string>;
};

type Props = {
  blocks: BlockDisplayData[];
  canvasWidth: number;
  /** Width of the rendered viewport in screen pixels. */
  displayWidth: number;
};

export function BlockOverlayDisplay({ blocks, canvasWidth, displayWidth }: Props) {
  if (blocks.length === 0) return null;

  const displayScale = displayWidth / canvasWidth;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {blocks.map((b) => {
        const template = getBlockTemplate(b.block_type);
        if (!template) return null;

        const w = b.width * displayScale;

        return (
          <div
            key={b.id}
            className="absolute"
            style={{
              left: b.x * displayScale,
              top: b.y * displayScale,
              width: w,
              transform: `translate(-50%, -50%) rotate(${b.rotation}deg)`,
            }}
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
                  fontSize: 13 * displayScale,
                }}
              >
                {template.title}
              </div>
              <div
                className="px-3 py-3 flex flex-col gap-2.5"
                style={{ fontSize: 13 * displayScale }}
              >
                {template.fields.map((f) => {
                  const value = b.data[f.key] ?? "";
                  if (f.big) {
                    return (
                      <div key={f.key} className="flex flex-col gap-1">
                        {f.label && (
                          <span
                            className="t-lo"
                            style={{
                              fontSize: 11 * displayScale,
                              color: "var(--ink-3, var(--ink-2))",
                            }}
                          >
                            {f.label}
                          </span>
                        )}
                        <div
                          className="rounded border border-dashed px-2 py-1.5 whitespace-pre-wrap break-words"
                          style={{
                            borderColor: "var(--stroke)",
                            minHeight: (f.tall ? 84 : 48) * displayScale,
                            lineHeight: 1.6,
                            fontSize: 13 * displayScale,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="flex items-baseline gap-2">
                      {f.label && (
                        <span
                          className="t-lo whitespace-nowrap shrink-0"
                          style={{
                            fontSize: 11 * displayScale,
                            minWidth: 78 * displayScale,
                            color: "var(--ink-3, var(--ink-2))",
                          }}
                        >
                          {f.label}
                        </span>
                      )}
                      <span
                        className="flex-1 min-w-0 border-b border-dotted px-0.5 py-0.5 break-words"
                        style={{
                          borderColor: "var(--stroke)",
                          fontSize: 13 * displayScale,
                        }}
                      >
                        {value || " "}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
