"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { validateVideo } from "@/lib/video-utils";
import { triggerBatonNotification } from "@/lib/notifications";
import { DiaryCanvas, DIARY_CANVAS_WIDTH, DIARY_CANVAS_HEIGHT } from "@/components/diary-canvas";
import type { DiaryCanvasHandle } from "@/components/diary-canvas";
import { StampPicker, StampOverlayEditor, MAX_STAMPS } from "@/components/stamps";
import type { PlacedStamp } from "@/components/stamps";
import { MediaOverlayEditor, type PlacedMedia } from "@/components/placed-media";
import { FlipbookEditor, type FlipbookData, DraggableFlipbook, type PlacedFlipbook } from "@/components/flipbook";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImagePlus, Film, BookOpen, Loader2 } from "lucide-react";

// Center of the A4 canvas — new items drop here by default.
const CANVAS_CENTER_X = DIARY_CANVAS_WIDTH / 2;
const CANVAS_CENTER_Y = DIARY_CANVAS_HEIGHT / 2;

// Base display width on the canvas for newly placed media.
// Roughly 35% of page width — large enough to see, small enough that
// multiple photos fit on the same page.
const MEDIA_BASE_WIDTH = 280;
const MAX_IMAGES = 10;
const MAX_VIDEOS = 3;

// Default size for a newly-placed flipbook on the 800×600 canvas.
// 4:3 to match the flipbook's internal aspect ratio.
const FLIPBOOK_BASE_WIDTH = 300;
const FLIPBOOK_BASE_HEIGHT = 225;

// Read natural dimensions from a compressed image/video File so we can
// preserve its aspect ratio when placed on the canvas.
function measureImage(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("failed to load image")); };
    img.src = url;
  });
}

function measureVideo(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.muted = true;
    vid.playsInline = true;
    vid.onloadedmetadata = () => {
      const w = vid.videoWidth || 1;
      const h = vid.videoHeight || 1;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    vid.onerror = () => { URL.revokeObjectURL(url); reject(new Error("failed to load video")); };
    vid.src = url;
  });
}

export default function NewEntryPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [placedMedia, setPlacedMedia] = useState<PlacedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextBatonHolder, setNextBatonHolder] = useState<string | null>(null);
  // `members` excludes the current user — you can't pass the baton to
  // yourself, that would break the whole exchange-diary concept.
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [flipbookData, setFlipbookData] = useState<FlipbookData | null>(null);
  const [flipbookPlacement, setFlipbookPlacement] = useState<PlacedFlipbook | null>(null);
  const [flipbookSelected, setFlipbookSelected] = useState(false);
  const [showFlipbookEditor, setShowFlipbookEditor] = useState(false);
  const [placedStamps, setPlacedStamps] = useState<PlacedStamp[]>([]);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<DiaryCanvasHandle>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const stampPickerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // On mobile the picker renders below the (tall A4) canvas and is
  // easy to miss. Auto-scroll it into view whenever it opens.
  useEffect(() => {
    if (!showStampPicker) return;
    stampPickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showStampPicker]);

  useEffect(() => {
    let mounted = true;
    const loadMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("group_members").select("user:users(id, name)").eq("group_id", groupId);
      if (data && mounted) {
        const list = (data as { user: { id: string; name: string } | null }[]).map((m) => m.user).filter((u): u is { id: string; name: string } => u !== null);
        const others = list.filter((m) => m.id !== user.id);
        setMembers(others);
        setNextBatonHolder(others[0]?.id ?? null);
        setMembersLoaded(true);
      }
    };
    loadMembers();
    return () => { mounted = false; };
  }, [groupId, supabase]);

  // Stagger successive placements so pieces don't stack exactly on top
  // of each other — offsets wrap around a small diagonal.
  const placementOffset = (index: number) => {
    const k = index % 6;
    return { dx: k * 30 - 60, dy: k * 20 - 40 };
  };

  const countByType = (type: "image" | "video") =>
    placedMedia.filter((m) => m.type === type).length;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      if (countByType("image") + i >= MAX_IMAGES) break;
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
        const { width, height } = await measureImage(compressed);
        const previewUrl = URL.createObjectURL(compressed);
        setPlacedMedia((prev) => {
          if (prev.filter((m) => m.type === "image").length >= MAX_IMAGES) {
            URL.revokeObjectURL(previewUrl);
            return prev;
          }
          const { dx, dy } = placementOffset(prev.length);
          const aspect = height / width;
          return [
            ...prev,
            {
              instanceId: crypto.randomUUID(),
              type: "image",
              file: compressed,
              previewUrl,
              x: CANVAS_CENTER_X + dx,
              y: CANVAS_CENTER_Y + dy,
              scale: 1,
              rotation: 0,
              baseWidth: MEDIA_BASE_WIDTH,
              baseHeight: MEDIA_BASE_WIDTH * aspect,
            },
          ];
        });
      } catch (err) { console.error("Image processing failed:", err); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      if (countByType("video") + i >= MAX_VIDEOS) break;
      const file = files[i];
      const result = await validateVideo(file);
      if (!result.valid) { setError(result.error); continue; }
      try {
        const { width, height } = await measureVideo(file);
        const previewUrl = URL.createObjectURL(file);
        setPlacedMedia((prev) => {
          if (prev.filter((m) => m.type === "video").length >= MAX_VIDEOS) {
            URL.revokeObjectURL(previewUrl);
            return prev;
          }
          const { dx, dy } = placementOffset(prev.length);
          const aspect = height / width;
          return [
            ...prev,
            {
              instanceId: crypto.randomUUID(),
              type: "video",
              file,
              previewUrl,
              x: CANVAS_CENTER_X + dx,
              y: CANVAS_CENTER_Y + dy,
              scale: 1,
              rotation: 0,
              baseWidth: MEDIA_BASE_WIDTH,
              baseHeight: MEDIA_BASE_WIDTH * aspect,
            },
          ];
        });
      } catch (err) { console.error("Video processing failed:", err); }
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const canvasEmpty = canvasRef.current?.isEmpty() ?? true;
    if (canvasEmpty && placedMedia.length === 0 && placedStamps.length === 0 && !flipbookData) { setError("日記を書くか画像・動画・スタンプ・パラパラアニメを追加してください"); return; }
    if (!nextBatonHolder) { setError("バトンを渡すメンバーがいません。先にグループに招待してください"); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setLoading(false); return; }

    // Capture the current canvas background type so the viewer can
    // reproduce it exactly with CSS — the PNG is saved transparent.
    const canvasBackground = !canvasEmpty ? canvasRef.current?.getBackground() ?? null : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error: entryError } = await (supabase as any).from("entries").insert({ group_id: groupId, author_id: user.id, body: null, canvas_background: canvasBackground, canvas_width: DIARY_CANVAS_WIDTH, canvas_height: DIARY_CANVAS_HEIGHT }).select().single();
    if (entryError) { setError(entryError.message); setLoading(false); return; }

    if (!canvasEmpty && canvasRef.current) {
      const blob = await canvasRef.current.exportImage();
      if (blob) {
        const path = `${groupId}/${entry.id}/canvas.png`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/png" });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("entry_media").insert({ entry_id: entry.id, type: "image", url: publicUrl, order: 0 });
        }
      }
    }

    // Upload each placed image/video, then record its canvas position
    // so the viewer can render the overlay at the exact spot the author
    // dropped it.
    const mediaOrderStart = canvasEmpty ? 0 : 1;
    for (let i = 0; i < placedMedia.length; i++) {
      const m = placedMedia[i];
      if (!m.file) continue;
      const isVideo = m.type === "video";
      const path = isVideo
        ? `${groupId}/${entry.id}/video/${m.instanceId}`
        : `${groupId}/${entry.id}/${m.instanceId}`;
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, m.file, isVideo ? { contentType: m.file.type } : undefined);
      if (upErr) { console.error(upErr); continue; }
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_media").insert({
        entry_id: entry.id,
        type: m.type,
        url: publicUrl,
        order: mediaOrderStart + i,
        x: m.x,
        y: m.y,
        scale: m.scale,
        rotation: m.rotation,
        base_width: m.baseWidth,
        width: Math.round(m.baseWidth),
        height: Math.round(m.baseHeight),
      });
    }

    if (placedStamps.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_stamps").insert(placedStamps.map((s) => ({ entry_id: entry.id, stamp_id: s.stampId, x: s.x, y: s.y, scale: s.scale, rotation: s.rotation })));
    }

    // Save flipbook animation with its canvas placement (if any)
    if (flipbookData && flipbookData.frames.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fb } = await (supabase as any).from("flipbooks").insert({
        entry_id: entry.id,
        fps: flipbookData.fps,
        loop: flipbookData.loop,
        x: flipbookPlacement?.x ?? null,
        y: flipbookPlacement?.y ?? null,
        scale: flipbookPlacement?.scale ?? null,
        rotation: flipbookPlacement?.rotation ?? null,
        base_width: flipbookPlacement?.baseWidth ?? null,
        base_height: flipbookPlacement?.baseHeight ?? null,
      }).select().single();
      if (fb) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("flipbook_frames").insert(
          flipbookData.frames.map((f) => ({ flipbook_id: fb.id, order: f.order, canvas_json: f.canvasJson }))
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("groups").update({ current_baton_holder_id: nextBatonHolder, baton_passed_at: new Date().toISOString() }).eq("id", groupId);
    // Fire-and-forget notification
    triggerBatonNotification(groupId, nextBatonHolder);
    router.push(`/groups/${groupId}`);
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="text-ink-light hover:text-ink transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold text-ink">日記を書く</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        {error && (
          <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Canvas */}
          <div ref={canvasWrapperRef} className="relative scroll-mt-20">
            <DiaryCanvas
              ref={canvasRef} width={DIARY_CANVAS_WIDTH} height={DIARY_CANVAS_HEIGHT}
              onScaleChange={setCanvasScale}
              onStampClick={() => setShowStampPicker((v) => !v)}
              stampCount={placedStamps.length}
              stampOverlay={
                <>
                  {placedMedia.length > 0 && (
                    <MediaOverlayEditor
                      media={placedMedia}
                      onMediaChange={setPlacedMedia}
                      canvasScale={canvasScale}
                    />
                  )}
                  {flipbookPlacement && (
                    <div
                      className="absolute inset-0"
                      style={{ zIndex: 4 }}
                      onClick={() => setFlipbookSelected(false)}
                    >
                      <DraggableFlipbook
                        flipbook={flipbookPlacement}
                        canvasScale={canvasScale}
                        selected={flipbookSelected}
                        onSelect={() => setFlipbookSelected(true)}
                        onUpdate={(updates) =>
                          setFlipbookPlacement((prev) => (prev ? { ...prev, ...updates } : prev))
                        }
                        onEdit={() => setShowFlipbookEditor(true)}
                        onDelete={() => {
                          setFlipbookPlacement(null);
                          setFlipbookData(null);
                          setFlipbookSelected(false);
                        }}
                      />
                    </div>
                  )}
                  {placedStamps.length > 0 && (
                    <StampOverlayEditor stamps={placedStamps} onStampsChange={setPlacedStamps} canvasWidth={DIARY_CANVAS_WIDTH} canvasHeight={DIARY_CANVAS_HEIGHT} canvasScale={canvasScale} />
                  )}
                </>
              }
            />
            {showStampPicker && (
              <div ref={stampPickerRef} className="mt-3 scroll-mt-20">
                <StampPicker
                  groupId={groupId}
                  onSelect={(stamp) => {
                    if (placedStamps.length >= MAX_STAMPS) return;
                    setPlacedStamps((p) => [
                      ...p,
                      {
                        instanceId: crypto.randomUUID(),
                        stampId: stamp.id,
                        url: stamp.url,
                        x: CANVAS_CENTER_X,
                        y: CANVAS_CENTER_Y,
                        scale: 1,
                        rotation: 0,
                      },
                    ]);
                    // Close + scroll back to the canvas so the user
                    // immediately sees the newly placed stamp. On the
                    // tall mobile A4 layout the picker sits well below
                    // the canvas, so without this the new stamp lands
                    // off-screen and the user can't tell it worked.
                    setShowStampPicker(false);
                    requestAnimationFrame(() => {
                      canvasWrapperRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    });
                  }}
                  onClose={() => setShowStampPicker(false)}
                />
              </div>
            )}
          </div>

          {/* Media — images/videos are placed directly on the canvas */}
          <div className="paper-plain rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-ink-light">写真・動画をノートに貼る</span>
              <span className="text-xs text-ink-light/50">
                画像 {countByType("image")}/{MAX_IMAGES}・動画 {countByType("video")}/{MAX_VIDEOS}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={countByType("image") >= MAX_IMAGES}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-cream-dark rounded-lg text-xs text-ink-light hover:border-moss/40 hover:text-moss transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus className="size-4" />
                写真を追加
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={countByType("video") >= MAX_VIDEOS}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-cream-dark rounded-lg text-xs text-ink-light hover:border-moss/40 hover:text-moss transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Film className="size-4" />
                動画を追加
              </button>
            </div>
            <p className="mt-2 text-[10px] text-ink-light/50">
              ノートに貼った後、ドラッグで移動・選択中のボタンで拡大縮小や回転ができます
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" multiple onChange={handleVideoSelect} className="hidden" />
          </div>

          {/* Flipbook — placed as an overlay on the canvas. The side
              panel just hosts the "add" entry point; once placed, the
              user interacts with it directly on the notebook. */}
          {!flipbookPlacement && (
            <div className="paper-plain rounded-xl p-4">
              <button type="button" onClick={() => setShowFlipbookEditor(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-cream-dark rounded-lg text-xs text-ink-light hover:border-moss/40 hover:text-moss transition-colors">
                <BookOpen className="size-4" />
                パラパラアニメをノートに貼る
              </button>
            </div>
          )}

          {showFlipbookEditor && (
            <FlipbookEditor
              initial={flipbookData ?? undefined}
              onSave={(data) => {
                setFlipbookData(data);
                // First-time save → drop it at canvas center. Otherwise
                // preserve existing position/scale/rotation but refresh
                // the preview to the new first frame.
                const firstFrame = data.frames[0]?.canvasJson ?? null;
                setFlipbookPlacement((prev) =>
                  prev
                    ? { ...prev, previewDataUrl: firstFrame }
                    : {
                        x: CANVAS_CENTER_X,
                        y: CANVAS_CENTER_Y,
                        scale: 1,
                        rotation: 0,
                        baseWidth: FLIPBOOK_BASE_WIDTH,
                        baseHeight: FLIPBOOK_BASE_HEIGHT,
                        previewDataUrl: firstFrame,
                      }
                );
                setShowFlipbookEditor(false);
              }}
              onClose={() => setShowFlipbookEditor(false)}
            />
          )}

          {/* Baton */}
          <div className="paper-plain rounded-xl p-4">
            <span className="block text-xs font-medium text-ink-light mb-2">次にバトンを渡す人</span>
            {!membersLoaded ? (
              <p className="text-xs text-ink-light/50">読み込み中...</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-ink-light">
                他にメンバーがいません。
                <Link href={`/groups/${groupId}`} className="text-moss hover:underline ml-1">グループに招待</Link>
                してからバトンを渡してください。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.id} type="button" onClick={() => setNextBatonHolder(m.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${nextBatonHolder === m.id ? "bg-moss text-white" : "bg-cream-dark/60 text-ink-light hover:bg-cream-dark"}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading || !nextBatonHolder} className="w-full h-11 bg-moss hover:bg-moss-dark text-base rounded-xl">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "日記を投稿してバトンを渡す"}
          </Button>
        </form>
      </main>
    </div>
  );
}
