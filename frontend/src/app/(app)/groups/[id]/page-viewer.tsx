"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { EntryStampsDisplay } from "./entries/[entryId]/entry-stamps-display";
import { ReactionBar } from "./entries/[entryId]/reaction-bar";
import { FlipbookPlayer } from "@/components/flipbook";
import { CanvasBackground } from "@/components/diary-canvas";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type EntryData = {
  id: string;
  body: string | null;
  created_at: string;
  canvas_background: "ruled" | "plain" | "grid" | null;
  author: { id: string; name: string; avatar_url: string | null } | null;
  media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
  stamps: { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } }[];
  reactions: { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } }[];
  flipbook: { fps: number; loop: boolean; frames: { order: number; canvasJson: string }[] } | null;
};

type Props = {
  entries: EntryData[];
  initialIndex: number;
  groupId: string;
  currentUserId: string | null;
  hasBaton: boolean;
  isOwner: boolean;
  totalCount: number;
};

export function PageViewer({ entries, initialIndex, groupId, currentUserId, hasBaton, isOwner, totalCount }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const entry = entries[index];
  const pageNumber = totalCount - index; // newest = totalCount, oldest = 1
  const sortedMedia = entry?.media?.sort((a, b) => a.order - b.order) ?? [];
  // Canvas image is uploaded to `{group}/{entry}/canvas.png` — split it
  // from attached photos/videos so the handwritten page renders full-width
  // in its natural 4:3 aspect ratio.
  const canvasMedia = sortedMedia.find((m) => m.type === "image" && m.url.endsWith("/canvas.png")) ?? null;
  const attachedMedia = sortedMedia.filter((m) => m !== canvasMedia);

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

  const canDelete =
    !!entry &&
    (isOwner || (currentUserId != null && entry.author?.id === currentUserId));

  const handleDelete = async () => {
    if (!entry) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();

    // Clean up storage files under {group_id}/{entry_id}/ first. Failing to
    // remove storage is not fatal — the DB row is the source of truth.
    try {
      const prefix = `${groupId}/${entry.id}`;
      const list = async (path: string): Promise<string[]> => {
        const { data } = await supabase.storage.from("media").list(path, { limit: 100 });
        if (!data) return [];
        const out: string[] = [];
        for (const f of data) {
          // folders have a null id in the list response
          if (f.id === null) out.push(...(await list(`${path}/${f.name}`)));
          else out.push(`${path}/${f.name}`);
        }
        return out;
      };
      const paths = await list(prefix);
      if (paths.length > 0) await supabase.storage.from("media").remove(paths);
    } catch (err) {
      console.error("[PageViewer] storage cleanup failed:", err);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("entries").delete().eq("id", entry.id);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }

    setConfirmDelete(false);
    setDeleting(false);
    // Step back one page if we deleted the newest, else stay at the same
    // index (which now shows the next older entry).
    if (index >= entries.length - 1 && index > 0) setIndex(index - 1);
    router.refresh();
  };

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
      {/* Page — size to content (matches the 4:3 canvas written on /new).
          When the entry has a handwritten canvas we render the notebook
          background as SVG inside the canvas box, so the paper article
          itself is plain — no double rulings. */}
      <article
        className={`${canvasMedia ? "paper-plain" : "paper"} rounded-xl px-6 sm:px-10 pt-8 pb-10 page-shadow relative transition-all duration-150 ${
          direction === "left" ? "translate-x-[-8px] opacity-80" :
          direction === "right" ? "translate-x-[8px] opacity-80" : ""
        }`}
      >
        {/* Red margin line — only for non-canvas entries */}
        {!canvasMedia && <div className="absolute left-10 sm:left-14 top-0 bottom-0 w-px bg-coral/25" />}

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

        {/* Canvas (handwritten diary page).
            Layers (back to front):
              1. <CanvasBackground /> — SVG notebook ruling / grid / plain
              2. <Image> — transparent PNG of strokes + text boxes
              3. <EntryStampsDisplay> — positioned stamps */}
        {canvasMedia && (
          <div className="mb-6">
            <div className="relative aspect-[4/3] w-full max-w-[800px] mx-auto rounded-lg overflow-hidden border border-cream-dark/40">
              <CanvasBackground
                type={entry.canvas_background ?? "ruled"}
                className="absolute inset-0 w-full h-full"
              />
              <Image src={canvasMedia.url} alt="" fill className="object-contain" sizes="(max-width: 800px) 100vw, 800px" />
              {entry.stamps.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <EntryStampsDisplay stamps={entry.stamps} canvasWidth={800} canvasHeight={600} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other attached media (photos, videos) — thumbnail grid */}
        {attachedMedia.length > 0 && (
          <div className="pl-5 sm:pl-8 mb-6">
            <div className={`grid gap-3 ${attachedMedia.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2"}`}>
              {attachedMedia.map((media) =>
                media.type === "video" ? (
                  <div key={media.id} className="relative rounded-lg overflow-hidden bg-ink/5">
                    <video src={media.url} controls preload="metadata" playsInline className="w-full max-h-80 rounded-lg" />
                  </div>
                ) : (
                  <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden bg-cream-dark/30">
                    <Image src={media.url} alt="" fill className="object-cover" />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Stamps — only when there's no canvas (canvas renders stamps as an overlay above) */}
        {entry.stamps.length > 0 && !canvasMedia && (
          <div className="pl-5 sm:pl-8">
            <EntryStampsDisplay stamps={entry.stamps} canvasWidth={800} canvasHeight={600} />
          </div>
        )}

        {/* Flipbook animation */}
        {entry.flipbook && entry.flipbook.frames.length > 0 && (
          <div className="pl-5 sm:pl-8 mb-6">
            <p className="text-[10px] text-ink-light/40 mb-1.5 uppercase tracking-wider">パラパラアニメ</p>
            <FlipbookPlayer
              frames={entry.flipbook.frames}
              fps={entry.flipbook.fps}
              loop={entry.flipbook.loop}
              width={Math.min(400, 800 * 0.6)}
            />
          </div>
        )}

        {/* Delete button — visible to the author or group owner */}
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="absolute top-4 right-4 size-8 rounded-full flex items-center justify-center text-ink-light/40 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="この日記を削除"
          >
            <Trash2 className="size-4" />
          </button>
        )}

        {/* Page number */}
        <div className="absolute bottom-4 right-6 text-sm text-ink-light/25 font-handwriting">
          {pageNumber} / {totalCount}
        </div>
      </article>

      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!deleting) setConfirmDelete(open); }}>
        <DialogContent className="sm:max-w-md bg-cream">
          <DialogHeader>
            <DialogTitle className="text-base">この日記を削除しますか?</DialogTitle>
            <DialogDescription>
              削除すると、画像・スタンプ・パラパラアニメ・リアクションも一緒に消えます。元に戻せません。
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-xs text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              キャンセル
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
