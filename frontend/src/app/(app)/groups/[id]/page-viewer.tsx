"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { EntryStampsDisplay } from "./entries/[entryId]/entry-stamps-display";
import { ReactionBar } from "./entries/[entryId]/reaction-bar";
import { FlipbookPlayer, FlipbookOverlayDisplay } from "@/components/flipbook";
import { CanvasBackground } from "@/components/diary-canvas";
import { MediaOverlayDisplay } from "@/components/placed-media";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Legacy entries (pre-A4) default to 800×600. New entries store their
// actual canvas dimensions so the viewer can render them at the exact
// aspect the author drew on.
const LEGACY_CANVAS_WIDTH = 800;
const LEGACY_CANVAS_HEIGHT = 600;

type EntryData = {
  id: string;
  body: string | null;
  created_at: string;
  canvas_background: "ruled" | "plain" | "grid" | null;
  canvas_width: number | null;
  canvas_height: number | null;
  author: { id: string; name: string; avatar_url: string | null } | null;
  media: {
    id: string; type: string; url: string; order: number;
    width: number | null; height: number | null;
    x: number | null; y: number | null; scale: number | null;
    rotation: number | null; base_width: number | null;
  }[] | null;
  stamps: { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } }[];
  reactions: { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } }[];
  flipbook: {
    fps: number; loop: boolean;
    x: number | null; y: number | null; scale: number | null;
    rotation: number | null; base_width: number | null; base_height: number | null;
    frames: { order: number; canvasJson: string }[];
  } | null;
};

type BatonStatus = {
  holderName: string;
  holderAvatar: string | null;
  deadlineText: string | null;
  /** CSS color string — red when overdue / <24h left. */
  deadlineColor: string | undefined;
  nextInOrderName: string | null;
};

type Props = {
  entries: EntryData[];
  initialIndex: number;
  groupId: string;
  groupName?: string;
  /** Cover image URL. On mobile, shown as the first page. */
  coverImage?: string | null;
  currentUserId: string | null;
  hasBaton: boolean;
  isOwner: boolean;
  totalCount: number;
  /** Group-level baton state — shown as a subtle status bar above the
   *  current page, so the user always knows whose turn it is even when
   *  flipping through old entries. */
  batonStatus: BatonStatus | null;
};

export function PageViewer({ entries, initialIndex, groupId, groupName, coverImage, currentUserId, hasBaton, isOwner, totalCount, batonStatus }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  // Mobile-only cover: when a cover image exists, show it as the very
  // first page on small screens. Desktop renders the cover as a hero
  // banner above the viewer instead.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const hasCoverPage = isMobile && !!coverImage;
  const [showingCover, setShowingCover] = useState(false);
  // If the viewport switches off mobile (no cover page anymore), make sure
  // we're not stuck on a cover state. We never auto-open the cover —
  // mobile users land on the newest entry just like before.
  useEffect(() => {
    if (!hasCoverPage) setShowingCover(false);
  }, [hasCoverPage]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const entry = entries[index];
  const pageNumber = totalCount - index; // newest = totalCount, oldest = 1
  const sortedMedia = entry?.media?.sort((a, b) => a.order - b.order) ?? [];
  // Canvas image is uploaded to `{group}/{entry}/canvas.png` — split it
  // from attached photos/videos so the handwritten page renders full-width
  // in its natural 4:3 aspect ratio.
  // Match against the path portion only — the storage URL may carry a
  // query string (cache-bust, signed-URL token, etc.) and `endsWith` would
  // miss those. Falling back to includes() catches both shapes.
  const canvasMedia = sortedMedia.find(
    (m) => m.type === "image" && (m.url.endsWith("/canvas.png") || m.url.includes("/canvas.png?"))
  ) ?? null;
  const otherMedia = sortedMedia.filter((m) => m !== canvasMedia);
  // Media with a saved position are rendered as overlays on the canvas
  // (x/y/scale/rotation in 800×600 space). Legacy entries predate the
  // position columns — render those as a thumbnail grid below.
  const placedMedia = otherMedia
    .filter((m) => m.x != null && m.y != null && m.base_width != null)
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      x: m.x as number,
      y: m.y as number,
      scale: m.scale ?? 1,
      rotation: m.rotation ?? 0,
      base_width: m.base_width as number,
      width: m.width,
      height: m.height,
    }));
  const legacyMedia = otherMedia.filter(
    (m) => m.x == null || m.y == null || m.base_width == null
  );

  // Flipbook placement — when x/y/base_width are set the flipbook
  // renders as an overlay on the canvas box (mirroring placed media).
  // Otherwise it falls through to the legacy below-canvas section.
  const flipbookPlaced =
    entry?.flipbook != null &&
    entry.flipbook.frames.length > 0 &&
    entry.flipbook.x != null &&
    entry.flipbook.y != null &&
    entry.flipbook.base_width != null &&
    entry.flipbook.base_height != null;
  const hasCanvasBox = !!canvasMedia || placedMedia.length > 0 || flipbookPlaced;

  // Per-entry canvas dimensions — new entries store their actual A4
  // values; legacy entries fall back to the original 800×600.
  const entryCanvasWidth = entry?.canvas_width ?? LEGACY_CANVAS_WIDTH;
  const entryCanvasHeight = entry?.canvas_height ?? LEGACY_CANVAS_HEIGHT;
  const canvasAspectRatio = `${entryCanvasWidth} / ${entryCanvasHeight}`;

  // Track the canvas container's rendered width so MediaOverlayDisplay can
  // scale its canvas-space (800×600) coordinates down to the current size.
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const [canvasDisplayWidth, setCanvasDisplayWidth] = useState(entryCanvasWidth);
  useEffect(() => {
    const el = canvasBoxRef.current;
    if (!el) return;
    const update = () => setCanvasDisplayWidth(el.clientWidth || entryCanvasWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasCanvasBox, entryCanvasWidth]);

  const flip = useCallback((dir: "prev" | "next") => {
    // Cover-page transitions on mobile: the cover sits "before" index 0
    // (newest entry). Flipping prev from the newest entry brings the
    // cover back; flipping next from the cover advances to newest.
    if (showingCover) {
      if (dir === "next" && entries.length > 0) {
        setDirection("left");
        setTimeout(() => {
          setShowingCover(false);
          setIndex(0);
          setDirection(null);
        }, 150);
      }
      return;
    }
    if (hasCoverPage && dir === "prev" && index === 0) {
      setDirection("right");
      setTimeout(() => {
        setShowingCover(true);
        setDirection(null);
      }, 150);
      return;
    }
    const newIndex = dir === "prev" ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= entries.length) return;
    setDirection(dir === "prev" ? "right" : "left");
    // Brief delay for animation
    setTimeout(() => {
      setIndex(newIndex);
      setDirection(null);
    }, 150);
  }, [index, entries.length, showingCover, hasCoverPage]);

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
      if (dx > 0) {
        // Swipe right → previous (older, or back to cover)
        if (showingCover) {
          // already at cover
        } else if (index < entries.length - 1 || (hasCoverPage && index === 0)) {
          flip("prev");
        }
      } else {
        // Swipe left → next (newer, or out of cover)
        if (showingCover) flip("next");
        else if (index > 0) flip("next");
      }
    }
    setTouchStartX(null);
  };

  // Cover page (mobile only) — rendered as a full-bleed first page.
  // Falls through to the normal entry view once the user advances.
  if (showingCover && coverImage) {
    return (
      <div
        className="flex-1 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <article
          className={`paper-plain rounded-xl page-shadow relative overflow-hidden transition-all duration-150 ${
            direction === "left" ? "translate-x-[-8px] opacity-80" :
            direction === "right" ? "translate-x-[8px] opacity-80" : ""
          }`}
          style={{ aspectRatio: "3 / 4" }}
        >
          <Image
            src={coverImage}
            alt={`${groupName ?? ""}の表紙`}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" aria-hidden />
          {groupName && (
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <p className="meta-sm" style={{ color: "rgba(255,255,255,0.7)" }}>表紙</p>
              <h2 className="text-[22px] font-medium tracking-tight mt-1 leading-tight drop-shadow">
                {groupName}
              </h2>
            </div>
          )}
        </article>

        {/* Nav — only "next" is meaningful from the cover */}
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-sm text-ink-light/30">表紙</span>
          <span className="meta-sm">1 / {totalCount + 1}</span>
          <button
            type="button"
            onClick={() => flip("next")}
            disabled={entries.length === 0}
            className="flex items-center gap-1 text-sm text-ink-light hover:text-moss transition-colors disabled:opacity-25 disabled:pointer-events-none"
          >
            最新の日記 <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <>
        {batonStatus && <BatonStatusBar status={batonStatus} hasBaton={hasBaton} />}
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
      </>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {batonStatus && <BatonStatusBar status={batonStatus} hasBaton={hasBaton} />}

      {/* Page — size to content (matches the 4:3 canvas written on /new).
          When the entry has a handwritten canvas we render the notebook
          background as SVG inside the canvas box, so the paper article
          itself is plain — no double rulings. */}
      <article
        className={`${hasCanvasBox ? "paper-plain" : "paper"} rounded-xl px-6 sm:px-10 pt-8 pb-10 page-shadow relative transition-all duration-150 ${
          direction === "left" ? "translate-x-[-8px] opacity-80" :
          direction === "right" ? "translate-x-[8px] opacity-80" : ""
        }`}
      >
        {/* Red margin line — only for non-canvas entries */}
        {!hasCanvasBox && <div className="absolute left-10 sm:left-14 top-0 bottom-0 w-px bg-coral/25" />}

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
              3. <MediaOverlayDisplay> — placed photos/videos
              4. <EntryStampsDisplay> — positioned stamps */}
        {hasCanvasBox && (
          <div className="mb-6">
            <div
              ref={canvasBoxRef}
              className="relative w-full max-w-[800px] mx-auto rounded-lg overflow-hidden border border-cream-dark/40"
              style={{ aspectRatio: canvasAspectRatio }}
            >
              <CanvasBackground
                type={entry.canvas_background ?? "ruled"}
                width={entryCanvasWidth}
                height={entryCanvasHeight}
                className="absolute inset-0 w-full h-full"
              />
              {canvasMedia && (
                <Image src={canvasMedia.url} alt="" fill className="object-contain" sizes="(max-width: 800px) 100vw, 800px" />
              )}
              {placedMedia.length > 0 && (
                <div className="absolute inset-0">
                  <MediaOverlayDisplay
                    media={placedMedia}
                    canvasWidth={entryCanvasWidth}
                    displayWidth={canvasDisplayWidth}
                  />
                </div>
              )}
              {flipbookPlaced && entry.flipbook && (
                <div className="absolute inset-0">
                  <FlipbookOverlayDisplay
                    x={entry.flipbook.x as number}
                    y={entry.flipbook.y as number}
                    scale={entry.flipbook.scale ?? 1}
                    rotation={entry.flipbook.rotation ?? 0}
                    baseWidth={entry.flipbook.base_width as number}
                    baseHeight={entry.flipbook.base_height as number}
                    fps={entry.flipbook.fps}
                    loop={entry.flipbook.loop}
                    frames={entry.flipbook.frames}
                    canvasWidth={entryCanvasWidth}
                    displayWidth={canvasDisplayWidth}
                  />
                </div>
              )}
              {entry.stamps.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <EntryStampsDisplay stamps={entry.stamps} canvasWidth={entryCanvasWidth} canvasHeight={entryCanvasHeight} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legacy entries predating the placed-media feature — thumbnail grid */}
        {legacyMedia.length > 0 && (
          <div className="pl-5 sm:pl-8 mb-6">
            <div className={`grid gap-3 ${legacyMedia.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2"}`}>
              {legacyMedia.map((media) =>
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

        {/* Stamps — only when there's no canvas box (canvas renders stamps as an overlay above) */}
        {entry.stamps.length > 0 && !hasCanvasBox && (
          <div className="pl-5 sm:pl-8">
            <EntryStampsDisplay stamps={entry.stamps} canvasWidth={entryCanvasWidth} canvasHeight={entryCanvasHeight} />
          </div>
        )}

        {/* Flipbook animation — legacy fallback for entries written
            before flipbook placement. Placed flipbooks render on the
            canvas overlay above. */}
        {entry.flipbook && entry.flipbook.frames.length > 0 && !flipbookPlaced && (
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

function BatonStatusBar({ status, hasBaton }: { status: BatonStatus; hasBaton: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-cream-dark/30 border border-cream-dark/40">
      <span className="size-6 rounded-full bg-moss/15 text-moss text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
        {status.holderAvatar ? (
          // Not using next/image — the avatar URL set isn't whitelisted
          // in next.config and this is a tiny inline avatar.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.holderAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          status.holderName.charAt(0)
        )}
      </span>
      <span className="text-xs text-ink-light flex-1 min-w-0 truncate">
        今は
        <span className={`font-medium ml-0.5 ${hasBaton ? "text-moss" : "text-ink"}`}>
          {hasBaton ? "あなた" : status.holderName}
        </span>
        <span className="ml-0.5">の番</span>
      </span>
      {status.deadlineText && (
        <span className="text-xs shrink-0" style={{ color: status.deadlineColor }}>
          {status.deadlineText}
        </span>
      )}
      {status.nextInOrderName && (
        <span className="text-[11px] text-ink-light/50 shrink-0 hidden sm:inline">
          → 次: {status.nextInOrderName}
        </span>
      )}
    </div>
  );
}
