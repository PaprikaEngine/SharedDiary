"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EntryStampsDisplay } from "./entries/[entryId]/entry-stamps-display";
import { ReactionBar } from "./entries/[entryId]/reaction-bar";

type EntryData = {
  id: string;
  body: string | null;
  created_at: string;
  author: { id: string; name: string; avatar_url: string | null } | null;
  media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
  stamps: { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } }[];
  reactions: { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } }[];
};

type Props = {
  entries: EntryData[];
  initialIndex: number;
  groupId: string;
  currentUserId: string | null;
  hasBaton: boolean;
  totalCount: number;
};

export function PageViewer({ entries, initialIndex, groupId, currentUserId, hasBaton, totalCount }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const entry = entries[index];
  const pageNumber = totalCount - index; // newest = totalCount, oldest = 1
  const sortedMedia = entry?.media?.sort((a, b) => a.order - b.order) ?? [];

  const flip = useCallback((dir: "prev" | "next") => {
    const newIndex = dir === "prev" ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= entries.length) return;
    setDirection(dir === "prev" ? "right" : "left");
    // Brief delay for animation
    setTimeout(() => {
      setIndex(newIndex);
      setDirection(null);
    }, 150);
  }, [index, entries.length]);

  // Swipe handling
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) {
      if (dx > 0 && index < entries.length - 1) flip("prev");
      else if (dx < 0 && index > 0) flip("next");
    }
    setTouchStartX(null);
  };

  if (!entry) {
    return (
      <div className="paper-plain rounded-xl p-10 text-center">
        <p className="text-3xl mb-2">✏️</p>
        <p className="text-ink-light text-sm">
          {hasBaton ? "あなたの番です！最初のページを書きましょう" : "まだページがありません"}
        </p>
        {hasBaton && (
          <Link href={`/groups/${groupId}/new`}
            className="inline-block mt-4 text-sm font-medium text-white bg-moss hover:bg-moss-dark rounded-full px-4 py-2 transition-colors"
          >
            日記を書く
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Page — fill available height */}
      <article
        className={`paper rounded-xl px-6 sm:px-10 pt-8 pb-10 page-shadow relative flex-1 min-h-[60vh] transition-all duration-150 ${
          direction === "left" ? "translate-x-[-8px] opacity-80" :
          direction === "right" ? "translate-x-[8px] opacity-80" : ""
        }`}
      >
        {/* Red margin line */}
        <div className="absolute left-10 sm:left-14 top-0 bottom-0 w-px bg-coral/25" />

        {/* Author + date */}
        <div className="flex items-center gap-3 mb-6 pl-5 sm:pl-8">
          <span className="size-10 rounded-full bg-moss/15 text-moss text-base font-bold flex items-center justify-center shrink-0">
            {entry.author?.name?.charAt(0) ?? "?"}
          </span>
          <div>
            <p className="text-base font-semibold text-ink">{entry.author?.name}</p>
            <p className="text-sm text-ink-light/50">
              {new Date(entry.created_at).toLocaleDateString("ja-JP", {
                year: "numeric", month: "long", day: "numeric", weekday: "short",
              })}
            </p>
          </div>
        </div>

        {/* Body text */}
        {entry.body && (
          <div className="pl-5 sm:pl-8 mb-6">
            <p className="text-ink whitespace-pre-wrap leading-[32px] text-base">
              {entry.body}
            </p>
          </div>
        )}

        {/* Media */}
        {sortedMedia.length > 0 && (
          <div className="pl-5 sm:pl-8 mb-6">
            <div className={`grid gap-3 ${sortedMedia.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2"}`}>
              {sortedMedia.map((media) => (
                <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden bg-cream-dark/30">
                  <Image src={media.url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stamps */}
        {entry.stamps.length > 0 && sortedMedia.length > 0 && (
          <div className="pl-5 sm:pl-8">
            <EntryStampsDisplay stamps={entry.stamps} canvasWidth={800} canvasHeight={600} />
          </div>
        )}

        {/* Page number */}
        <div className="absolute bottom-4 right-6 text-sm text-ink-light/25 font-handwriting">
          {pageNumber} / {totalCount}
        </div>
      </article>

      {/* Reactions + Navigation */}
      <div className="flex items-center justify-between mt-3 px-1">
        <button
          type="button"
          onClick={() => flip("prev")}
          disabled={index >= entries.length - 1}
          className="flex items-center gap-1 text-sm text-ink-light hover:text-moss transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronLeft className="size-4" /> 前のページ
        </button>
        <div className="flex-1 flex justify-center px-2">
          <ReactionBar entryId={entry.id} groupId={groupId} reactions={entry.reactions} currentUserId={currentUserId} />
        </div>
        <button
          type="button"
          onClick={() => flip("next")}
          disabled={index <= 0}
          className="flex items-center gap-1 text-sm text-ink-light hover:text-moss transition-colors disabled:opacity-25 disabled:pointer-events-none"
        >
          次のページ <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
