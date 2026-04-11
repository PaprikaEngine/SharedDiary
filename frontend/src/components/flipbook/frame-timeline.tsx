"use client";

import { useRef, useEffect } from "react";
import { Plus, Copy, Trash2 } from "lucide-react";

export type FrameThumb = {
  id: string;
  dataUrl: string | null;
};

type Props = {
  frames: FrameThumb[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  maxFrames: number;
};

const THUMB_W = 80;
const THUMB_H = 60;

export function FrameTimeline({ frames, currentIndex, onSelect, onAdd, onDuplicate, onDelete, maxFrames }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active frame into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentIndex]);

  return (
    <div className="bg-cream-dark/30 rounded-lg p-2">
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[10px] font-medium text-ink-light/60 uppercase tracking-wider">Frames</span>
        <span className="text-[10px] text-ink-light/40">{frames.length}/{maxFrames}</span>
      </div>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {frames.map((frame, i) => (
          <div key={frame.id} className="shrink-0 group relative">
            <button
              ref={i === currentIndex ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(i)}
              className={`block rounded-md overflow-hidden border-2 transition-all ${
                i === currentIndex
                  ? "border-moss shadow-md scale-105"
                  : "border-transparent hover:border-cream-dark"
              }`}
              style={{ width: THUMB_W, height: THUMB_H }}
            >
              {frame.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame.dataUrl} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center">
                  <span className="text-[10px] text-ink-light/30">{i + 1}</span>
                </div>
              )}
            </button>
            {/* Frame number */}
            <span className={`absolute -top-1 -left-1 text-[9px] font-bold rounded px-1 ${
              i === currentIndex ? "bg-moss text-white" : "bg-cream-dark text-ink-light/60"
            }`}>
              {i + 1}
            </span>
            {/* Actions on hover */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(i); }}
                disabled={frames.length >= maxFrames}
                className="size-5 bg-cream/90 rounded shadow text-ink-light hover:text-moss transition-colors flex items-center justify-center disabled:opacity-30" title="複製">
                <Copy className="size-3" />
              </button>
              {frames.length > 1 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                  className="size-5 bg-cream/90 rounded shadow text-ink-light hover:text-red-500 transition-colors flex items-center justify-center" title="削除">
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          </div>
        ))}
        {/* Add frame button */}
        {frames.length < maxFrames && (
          <button type="button" onClick={onAdd}
            className="shrink-0 rounded-md border-2 border-dashed border-cream-dark hover:border-moss/40 flex items-center justify-center transition-colors"
            style={{ width: THUMB_W, height: THUMB_H }}>
            <Plus className="size-4 text-ink-light/40" />
          </button>
        )}
      </div>
    </div>
  );
}
