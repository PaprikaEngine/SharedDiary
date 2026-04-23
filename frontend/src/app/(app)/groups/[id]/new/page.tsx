"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { validateVideo } from "@/lib/video-utils";
import { triggerBatonNotification } from "@/lib/notifications";
import { DiaryCanvas, DIARY_CANVAS_WIDTH, DIARY_CANVAS_HEIGHT, TapePicker } from "@/components/diary-canvas";
import type { DiaryCanvasHandle, TapeId, DiarySnapshot, Tool } from "@/components/diary-canvas";
import { StampPicker, StampOverlayEditor, MAX_STAMPS } from "@/components/stamps";
import type { PlacedStamp } from "@/components/stamps";
import { MediaOverlayEditor, type PlacedMedia } from "@/components/placed-media";
import { FlipbookEditor, type FlipbookData, DraggableFlipbook, type PlacedFlipbook } from "@/components/flipbook";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImagePlus, Film, BookOpen, Loader2 } from "lucide-react";
import { saveDraft, loadDraft, clearDraft, type Draft } from "@/lib/draft-storage";

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
  // All members in baton rotation order (including the current user).
  // Next holder is derived from this list automatically.
  const [allMembersOrdered, setAllMembersOrdered] = useState<{ id: string; name: string; memberOrder: number | null }[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [flipbookData, setFlipbookData] = useState<FlipbookData | null>(null);
  const [flipbookPlacement, setFlipbookPlacement] = useState<PlacedFlipbook | null>(null);
  const [flipbookSelected, setFlipbookSelected] = useState(false);
  const [showFlipbookEditor, setShowFlipbookEditor] = useState(false);
  const [placedStamps, setPlacedStamps] = useState<PlacedStamp[]>([]);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showTapePicker, setShowTapePicker] = useState(false);
  const [extraTapeIds, setExtraTapeIds] = useState<TapeId[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  // Selection is lifted to the page so a click on the draw canvas can
  // clear whichever overlay item was selected, and so the shared
  // z-counter below can bump the selected item to the front regardless
  // of its type (media / flipbook / stamp).
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  // Shared render-order counter. Each placed item stores its own `z`;
  // on add and on select we bump the counter and assign the new value
  // so the item jumps in front of everything. Starts at a base that's
  // safely above the draw canvas's (implicit) zero.
  const zCounterRef = useRef(10);
  const nextZ = useCallback(() => ++zCounterRef.current, []);

  // Mirror of the DiaryCanvas's internal tool so we can disable
  // overlay interactivity while a drawing tool is active — placed
  // items should pass pointer events through to the draw canvas so
  // pen / eraser / tape can draw over them.
  const [currentTool, setCurrentTool] = useState<Tool>("select");
  const overlaysInteractive = currentTool === "select";

  // Draft persistence — the DiaryCanvas is only rendered once the
  // initial IDB read has resolved so its `initialSnapshot` hydrates
  // on first mount. `latestDiaryRef` tracks the most recent canvas
  // state (fed via onChange) so the auto-save effect can read it
  // without depending on it as a React state.
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<DiarySnapshot | undefined>(undefined);
  const latestDiaryRef = useRef<DiarySnapshot | null>(null);
  const [diaryVersion, setDiaryVersion] = useState(0);
  const handleDiaryChange = useCallback((snap: DiarySnapshot) => {
    latestDiaryRef.current = snap;
    setDiaryVersion((v) => v + 1);
  }, []);
  const clearAllSelections = useCallback(() => {
    setSelectedStampId(null);
    setSelectedMediaId(null);
    setFlipbookSelected(false);
  }, []);

  const handleToolChange = useCallback((t: Tool) => {
    setCurrentTool(t);
    // Leaving select mode hides the selection affordances, so also
    // clear the underlying selection — otherwise the user comes
    // back to a "phantom" selection the next time they switch back.
    if (t !== "select") {
      setSelectedStampId(null);
      setSelectedMediaId(null);
      setFlipbookSelected(false);
    }
  }, []);

  // Selecting an item bumps it to the top of the shared z-order while
  // also clearing selections on the other overlays — only one item can
  // be selected at a time.
  const handleSelectStamp = useCallback((id: string | null) => {
    setSelectedStampId(id);
    setSelectedMediaId(null);
    setFlipbookSelected(false);
    if (id) {
      const z = nextZ();
      setPlacedStamps((prev) => prev.map((s) => (s.instanceId === id ? { ...s, z } : s)));
    }
  }, [nextZ]);

  const handleSelectMedia = useCallback((id: string | null) => {
    setSelectedMediaId(id);
    setSelectedStampId(null);
    setFlipbookSelected(false);
    if (id) {
      const z = nextZ();
      setPlacedMedia((prev) => prev.map((m) => (m.instanceId === id ? { ...m, z } : m)));
    }
  }, [nextZ]);

  const handleSelectFlipbook = useCallback(() => {
    setFlipbookSelected(true);
    setSelectedStampId(null);
    setSelectedMediaId(null);
    const z = nextZ();
    setFlipbookPlacement((prev) => (prev ? { ...prev, z } : prev));
  }, [nextZ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<DiaryCanvasHandle>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const stampPickerRef = useRef<HTMLDivElement>(null);
  const tapePickerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // On mobile the picker renders below the (tall A4) canvas and is
  // easy to miss. Auto-scroll it into view whenever it opens.
  useEffect(() => {
    if (!showStampPicker) return;
    stampPickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showStampPicker]);

  useEffect(() => {
    if (!showTapePicker) return;
    tapePickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showTapePicker]);

  useEffect(() => {
    let mounted = true;
    const loadMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setCurrentUserId(user.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("group_members")
        .select("user:users(id, name), member_order")
        .eq("group_id", groupId)
        .order("member_order", { ascending: true });
      if (data && mounted) {
        const list = (data as { user: { id: string; name: string } | null; member_order: number | null }[])
          .filter((m) => m.user !== null)
          .map((m) => ({ id: m.user!.id, name: m.user!.name, memberOrder: m.member_order }));
        setAllMembersOrdered(list);
        setMembersLoaded(true);
      }
    };
    loadMembers();
    return () => { mounted = false; };
  }, [groupId, supabase]);

  // Load group tapes (so their tiles are registered) and the saved
  // draft (if any) before the canvas is revealed. Doing both in one
  // effect lets a draft reference group tapes without the canvas
  // hitting a missing-tile placeholder.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Group tapes — register tiles, populate picker
      const { loadTapeFromUrl, registerTape, TAPES } = await import("@/components/diary-canvas/tape-patterns");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tapeRows } = await (supabase as any)
        .from("tapes")
        .select("id, name, image_url")
        .eq("scope", "group")
        .eq("group_id", groupId);
      const tapeIds: string[] = [];
      if (tapeRows) {
        for (const r of tapeRows as { id: string; name: string; image_url: string }[]) {
          if (TAPES[r.id]) { tapeIds.push(r.id); continue; }
          const def = await loadTapeFromUrl({ id: r.id, label: r.name, url: r.image_url, scope: "group" });
          if (def) { registerTape(def); tapeIds.push(def.id); }
        }
      }
      if (cancelled) return;
      setExtraTapeIds(tapeIds);

      // Draft — hydrate page state + initialSnapshot for DiaryCanvas
      const draft = await loadDraft(groupId);
      if (cancelled) return;
      if (draft) {
        setInitialSnapshot(draft.diary);
        setPlacedStamps(draft.placedStamps);
        setPlacedMedia(
          draft.placedMedia.map((m) => ({
            instanceId: m.instanceId,
            type: m.type,
            previewUrl: m.url,
            uploadedPath: m.path,
            x: m.x, y: m.y, scale: m.scale, rotation: m.rotation,
            baseWidth: m.baseWidth, baseHeight: m.baseHeight,
            z: m.z,
          }))
        );
        setFlipbookData(draft.flipbookData);
        setFlipbookPlacement(draft.flipbookPlacement);
        // Resume the z counter above everything already placed.
        zCounterRef.current = Math.max(zCounterRef.current, draft.zCounter);
      }
      setDraftLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [groupId, supabase]);

  // Auto-save on any persistable state change. Debounced at 1s so a
  // continuous drag / typing session writes once rather than per
  // render. Media bytes are NOT in the draft — files are uploaded to
  // R2 at paste time, so we only persist their URLs.
  useEffect(() => {
    if (!draftLoaded) return;
    const id = window.setTimeout(() => {
      const diary = latestDiaryRef.current;
      if (!diary) return;
      const draft: Draft = {
        savedAt: Date.now(),
        diary,
        placedStamps,
        placedMedia: placedMedia.map((m) => ({
          instanceId: m.instanceId,
          type: m.type,
          url: m.previewUrl,
          path: m.uploadedPath,
          x: m.x, y: m.y, scale: m.scale, rotation: m.rotation,
          baseWidth: m.baseWidth, baseHeight: m.baseHeight,
          z: m.z,
        })),
        flipbookData,
        flipbookPlacement,
        zCounter: zCounterRef.current,
      };
      saveDraft(groupId, draft);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [draftLoaded, diaryVersion, placedStamps, placedMedia, flipbookData, flipbookPlacement, groupId]);

  // Stagger successive placements so pieces don't stack exactly on top
  // of each other — offsets wrap around a small diagonal.
  const placementOffset = (index: number) => {
    const k = index % 6;
    return { dx: k * 30 - 60, dy: k * 20 - 40 };
  };

  const countByType = (type: "image" | "video") =>
    placedMedia.filter((m) => m.type === type).length;

  // Upload a single file to R2 at paste time so the draft only ever
  // carries URLs. Returns the public URL + the R2 object key so the
  // composer can delete the file later if the user removes the item.
  const uploadMedia = useCallback(async (file: File | Blob, kind: "image" | "video", instanceId: string): Promise<{ url: string; path: string } | null> => {
    const ext = (file instanceof File ? file.name.split(".").pop() : undefined) || (file.type.split("/")[1] ?? "bin");
    const prefix = kind === "video" ? "video" : "image";
    const path = `${groupId}/pending/${prefix}/${instanceId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(path, file, file.type ? { contentType: file.type } : undefined);
    if (upErr) {
      console.error("media upload failed:", upErr);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    return { url: publicUrl, path };
  }, [groupId, supabase]);

  // Tracks in-flight uploads so the UI can show progress and the
  // add buttons can disable themselves while busy.
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const queued = Array.from(files).slice(0, Math.max(0, MAX_IMAGES - countByType("image")));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadingCount((c) => c + queued.length);
    try {
      for (const file of queued) {
        if (!file.type.startsWith("image/")) { setUploadingCount((c) => c - 1); continue; }
        try {
          const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
          const { width, height } = await measureImage(compressed);
          const instanceId = crypto.randomUUID();
          const uploaded = await uploadMedia(compressed, "image", instanceId);
          if (!uploaded) { setError("画像のアップロードに失敗しました"); continue; }
          setPlacedMedia((prev) => {
            if (prev.filter((m) => m.type === "image").length >= MAX_IMAGES) return prev;
            const { dx, dy } = placementOffset(prev.length);
            const aspect = height / width;
            return [
              ...prev,
              {
                instanceId,
                type: "image",
                previewUrl: uploaded.url,
                uploadedPath: uploaded.path,
                x: CANVAS_CENTER_X + dx,
                y: CANVAS_CENTER_Y + dy,
                scale: 1,
                rotation: 0,
                baseWidth: MEDIA_BASE_WIDTH,
                baseHeight: MEDIA_BASE_WIDTH * aspect,
                z: nextZ(),
              },
            ];
          });
        } catch (err) {
          console.error("Image processing failed:", err);
        } finally {
          setUploadingCount((c) => c - 1);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const queued = Array.from(files).slice(0, Math.max(0, MAX_VIDEOS - countByType("video")));
    if (videoInputRef.current) videoInputRef.current.value = "";
    setUploadingCount((c) => c + queued.length);
    try {
      for (const file of queued) {
        try {
          const result = await validateVideo(file);
          if (!result.valid) { setError(result.error); continue; }
          const { width, height } = await measureVideo(file);
          const instanceId = crypto.randomUUID();
          const uploaded = await uploadMedia(file, "video", instanceId);
          if (!uploaded) { setError("動画のアップロードに失敗しました"); continue; }
          setPlacedMedia((prev) => {
            if (prev.filter((m) => m.type === "video").length >= MAX_VIDEOS) return prev;
            const { dx, dy } = placementOffset(prev.length);
            const aspect = height / width;
            return [
              ...prev,
              {
                instanceId,
                type: "video",
                previewUrl: uploaded.url,
                uploadedPath: uploaded.path,
                x: CANVAS_CENTER_X + dx,
                y: CANVAS_CENTER_Y + dy,
                scale: 1,
                rotation: 0,
                baseWidth: MEDIA_BASE_WIDTH,
                baseHeight: MEDIA_BASE_WIDTH * aspect,
                z: nextZ(),
              },
            ];
          });
        } catch (err) {
          console.error("Video processing failed:", err);
        } finally {
          setUploadingCount((c) => c - 1);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Derive the next baton holder from the ordered member list.
  // Round-robin: find the current user's position, take the next one.
  const orderedForNext = allMembersOrdered.filter((m) => m.memberOrder !== null);
  const currentUserIndex = orderedForNext.findIndex((m) => m.id === currentUserId);
  const nextHolder =
    orderedForNext.length > 1 && currentUserIndex !== -1
      ? orderedForNext[(currentUserIndex + 1) % orderedForNext.length]
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const canvasEmpty = canvasRef.current?.isEmpty() ?? true;
    if (canvasEmpty && placedMedia.length === 0 && placedStamps.length === 0 && !flipbookData) { setError("日記を書くか画像・動画・スタンプ・パラパラアニメを追加してください"); return; }
    if (!nextHolder) { setError("バトンを渡すメンバーがいません。先にグループに招待してください"); return; }
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

    // Media files are already in R2 (uploaded at paste time). Just
    // record each item's entry_media row pointing at its existing
    // URL, preserving canvas position so the viewer can re-render
    // the overlay.
    const mediaOrderStart = canvasEmpty ? 0 : 1;
    for (let i = 0; i < placedMedia.length; i++) {
      const m = placedMedia[i];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_media").insert({
        entry_id: entry.id,
        type: m.type,
        url: m.previewUrl,
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
    await (supabase as any).from("groups").update({ current_baton_holder_id: nextHolder.id, baton_passed_at: new Date().toISOString() }).eq("id", groupId);
    // Fire-and-forget notification
    triggerBatonNotification(groupId, nextHolder.id);
    // The entry is persisted — discard the local draft so the user
    // gets a blank canvas next time they compose for this group.
    await clearDraft(groupId);
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
            {!draftLoaded && (
              // Canvas is gated on the IDB read so initialSnapshot
              // is available on first render. The read is usually
              // sub-10ms so this skeleton rarely paints a full frame.
              <div
                style={{ aspectRatio: `${DIARY_CANVAS_WIDTH} / ${DIARY_CANVAS_HEIGHT}` }}
                className="w-full max-w-[800px] mx-auto border border-cream-dark rounded-lg bg-white flex items-center justify-center"
              >
                <Loader2 className="size-5 animate-spin text-ink-light" />
              </div>
            )}
            {draftLoaded && (
            <DiaryCanvas
              ref={canvasRef} width={DIARY_CANVAS_WIDTH} height={DIARY_CANVAS_HEIGHT}
              onScaleChange={setCanvasScale}
              onCanvasInteract={clearAllSelections}
              onStampClick={() => setShowStampPicker((v) => !v)}
              stampCount={placedStamps.length}
              extraTapeIds={extraTapeIds}
              onTapePickerClick={() => setShowTapePicker((v) => !v)}
              initialSnapshot={initialSnapshot}
              onChange={handleDiaryChange}
              onToolChange={handleToolChange}
              stampOverlay={
                <>
                  {placedMedia.length > 0 && (
                    <MediaOverlayEditor
                      media={placedMedia}
                      onMediaChange={setPlacedMedia}
                      canvasScale={canvasScale}
                      selectedId={selectedMediaId}
                      onSelect={handleSelectMedia}
                      interactive={overlaysInteractive}
                      onRemove={(item) => {
                        // Media is uploaded at paste time — clean up R2
                        // when the composer drops it. Fire-and-forget
                        // because the UI already reflects the removal.
                        supabase.storage.from("media").remove([item.uploadedPath]).then(
                          undefined,
                          (err) => console.warn("media cleanup failed:", err),
                        );
                      }}
                    />
                  )}
                  {flipbookPlacement && (
                    <DraggableFlipbook
                      flipbook={flipbookPlacement}
                      canvasScale={canvasScale}
                      selected={flipbookSelected}
                      onSelect={handleSelectFlipbook}
                      interactive={overlaysInteractive}
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
                  )}
                  {placedStamps.length > 0 && (
                    <StampOverlayEditor
                      stamps={placedStamps}
                      onStampsChange={setPlacedStamps}
                      canvasWidth={DIARY_CANVAS_WIDTH}
                      canvasHeight={DIARY_CANVAS_HEIGHT}
                      canvasScale={canvasScale}
                      selectedId={selectedStampId}
                      onSelect={handleSelectStamp}
                      interactive={overlaysInteractive}
                    />
                  )}
                </>
              }
            />
            )}
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
                        z: nextZ(),
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
            {showTapePicker && (
              <div ref={tapePickerRef} className="mt-3 scroll-mt-20">
                <TapePicker
                  groupId={groupId}
                  currentUserId={currentUserId}
                  onClose={() => setShowTapePicker(false)}
                  onTapeAdded={(id) =>
                    setExtraTapeIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                  }
                  onTapeRemoved={(id) =>
                    setExtraTapeIds((prev) => prev.filter((x) => x !== id))
                  }
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
                disabled={countByType("image") >= MAX_IMAGES || uploadingCount > 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-cream-dark rounded-lg text-xs text-ink-light hover:border-moss/40 hover:text-moss transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploadingCount > 0 ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                写真を追加
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={countByType("video") >= MAX_VIDEOS || uploadingCount > 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-dashed border-cream-dark rounded-lg text-xs text-ink-light hover:border-moss/40 hover:text-moss transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploadingCount > 0 ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
                動画を追加
              </button>
            </div>
            <p className="mt-2 text-[10px] text-ink-light/50">
              {uploadingCount > 0
                ? `アップロード中... (${uploadingCount}件)`
                : "ノートに貼った後、ドラッグで移動・選択中のボタンで拡大縮小や回転ができます"}
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
                        z: nextZ(),
                      }
                );
                setShowFlipbookEditor(false);
              }}
              onClose={() => setShowFlipbookEditor(false)}
            />
          )}

          {/* Baton — auto-determined by member_order sequence */}
          <div className="paper-plain rounded-xl p-4">
            <span className="block text-xs font-medium text-ink-light mb-2">次にバトンを渡す人</span>
            {!membersLoaded ? (
              <p className="text-xs text-ink-light/50">読み込み中...</p>
            ) : !nextHolder ? (
              <p className="text-xs text-ink-light">
                他にメンバーがいません。
                <Link href={`/groups/${groupId}`} className="text-moss hover:underline ml-1">グループに招待</Link>
                してからバトンを渡してください。
              </p>
            ) : (
              <p className="text-sm text-ink">→ {nextHolder.name}</p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading || !nextHolder} className="w-full h-11 bg-moss hover:bg-moss-dark text-base rounded-xl">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "日記を投稿してバトンを渡す"}
          </Button>
        </form>
      </main>
    </div>
  );
}
