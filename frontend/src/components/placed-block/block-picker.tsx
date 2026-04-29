"use client";

import { X } from "lucide-react";
import {
  BLOCK_TEMPLATES,
  PAGE_UNIT_BUDGET,
  unitsConsumed,
  type BlockTemplate,
} from "./block-templates";

type Props = {
  onSelect: (blockType: string) => void;
  onClose: () => void;
  /** Block types already placed on the canvas. Each block can only
   *  appear once; placed types are rendered as disabled. */
  placedBlockTypes: string[];
  compact?: boolean;
};

export function BlockPicker({
  onSelect,
  onClose,
  placedBlockTypes,
  compact = false,
}: Props) {
  const consumed = unitsConsumed(placedBlockTypes);
  const remaining = Math.max(0, PAGE_UNIT_BUDGET - consumed);
  const placedSet = new Set(placedBlockTypes);

  return (
    <div className={`card w-full max-w-[640px] mx-auto overflow-hidden ${compact ? "" : ""}`}>
      <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b rule-hair">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-[14.5px] font-medium tracking-tight t-hi">プロフィール項目</h3>
          <span className="meta-sm hidden sm:inline">
            残り {remaining} / {PAGE_UNIT_BUDGET}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="t-lo hover:t-hi transition-colors -mr-1 p-1"
          aria-label="閉じる"
        >
          <X className="size-4" strokeWidth={1.6} />
        </button>
      </header>

      {/* Budget meter — visualizes remaining capacity so the user can
          see at a glance which blocks will still fit. */}
      <div
        className="px-5 sm:px-6 py-3 border-b rule-hair"
        style={{ background: "var(--paper-alt)" }}
      >
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--stroke)" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${(consumed / PAGE_UNIT_BUDGET) * 100}%`,
              background: "var(--accent, var(--moss))",
            }}
          />
        </div>
        <div className="meta-sm mt-1.5 sm:hidden">
          残り {remaining} / {PAGE_UNIT_BUDGET}
        </div>
      </div>

      <ul className="divide-y rule-hair" style={{ borderColor: "var(--stroke)" }}>
        {BLOCK_TEMPLATES.map((tpl) => {
          const placed = placedSet.has(tpl.id);
          const fits = tpl.units <= remaining;
          const disabled = placed || !fits;

          return (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => !disabled && onSelect(tpl.id)}
                disabled={disabled}
                className="w-full flex items-start gap-3 px-5 sm:px-6 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-cream-dark/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium t-hi truncate">
                      {tpl.title}
                    </span>
                    <span className="meta-sm shrink-0">{tpl.units} unit</span>
                  </div>
                  <p className="meta-sm mt-0.5">
                    {placed
                      ? "・追加ずみ"
                      : !fits
                      ? "・このページには入りません"
                      : tpl.description}
                  </p>
                </div>
                <UnitDots count={tpl.units} disabled={disabled} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UnitDots({ count, disabled }: { count: number; disabled: boolean }) {
  // Visual size cue — small bar of dots equal to the block's unit
  // cost. Clamped so a 9-unit block doesn't dwarf a 4-unit one.
  const dots = Math.min(count, 12);
  return (
    <div className="flex items-center gap-0.5 mt-1 shrink-0" aria-hidden>
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className="block w-1 h-1 rounded-full"
          style={{
            background: disabled ? "var(--stroke)" : "var(--accent, var(--moss))",
            opacity: disabled ? 0.6 : 0.8,
          }}
        />
      ))}
    </div>
  );
}

export type { BlockTemplate };
