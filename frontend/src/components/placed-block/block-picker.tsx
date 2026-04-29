"use client";

import { X } from "lucide-react";
import { BLOCK_TEMPLATES, type BlockTemplate } from "./block-templates";

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
}: Props) {
  const placedSet = new Set(placedBlockTypes);

  return (
    <div className="card w-full max-w-[640px] mx-auto overflow-hidden">
      <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b rule-hair">
        <h3 className="text-[14.5px] font-medium tracking-tight t-hi">プロフィール項目</h3>
        <button
          type="button"
          onClick={onClose}
          className="t-lo hover:t-hi transition-colors -mr-1 p-1"
          aria-label="閉じる"
        >
          <X className="size-4" strokeWidth={1.6} />
        </button>
      </header>

      <ul className="divide-y rule-hair" style={{ borderColor: "var(--stroke)" }}>
        {BLOCK_TEMPLATES.map((tpl) => {
          const placed = placedSet.has(tpl.id);
          return (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => !placed && onSelect(tpl.id)}
                disabled={placed}
                className="w-full flex items-start gap-3 px-5 sm:px-6 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-cream-dark/30"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium t-hi truncate">
                    {tpl.title}
                  </span>
                  <p className="meta-sm mt-0.5">
                    {placed ? "・追加ずみ" : tpl.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type { BlockTemplate };
