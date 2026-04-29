"use client";

// Shared canvas-composing flow used by both the diary "new entry" page
// and the profile-book editor. The two routes differ only in:
//   - Page header / submit button copy
//   - Whether the baton-passing block + RPC fires (diary only)
//   - Whether an existing entry is replaced before insert (profile)
//   - The kind / profile_owner_member_id values written to entries
//   - The post-submit redirect target
//   - The IndexedDB draft key (so a profile draft never overwrites the
//     group's diary draft, and vice versa)
// All other interactions — canvas, stamps, tape, media, flipbook,
// blocks, draft persistence — are identical so the user experience
// stays consistent across the two surfaces.

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { TapeOverlayEditor, type PlacedTape } from "@/components/placed-tape";
import {
  BlockOverlayEditor,
  BlockPicker,
  type PlacedBlock,
} from "@/components/placed-block";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImagePlus, Film, BookOpen, Loader2 } from "lucide-react";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  diaryDraftKey,
  profileDraftKey,
  type Draft,
} from "@/lib/draft-storage";

// Profile-book mode uses a wider canvas (book-spread) to give the
// extra room a Heisei-era プロフィール帳 needs for blocks plus
// decorations side by side.
const PROFILE_CANVAS_WIDTH = DIARY_CANVAS_WIDTH * 2;  // 1600
const PROFILE_CANVAS_HEIGHT = DIARY_CANVAS_HEIGHT;    // 1131

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

export type EntryComposerMode = "diary" | "profile";

export type ProfileMember = {
  /** users.id of the profile owner. Profiles are scoped (group, user)
   *  so this is unique per group. */
  userId: string;
  name: string;
};

type Props = {
  groupId: string;
  mode: EntryComposerMode;
  /** Required when mode === 'profile'. Identifies whose profile is
   *  being edited. */
  profileMember?: ProfileMember;
};

export function EntryComposer({ groupId, mode, profileMember }: Props) {
  const isProfile = mode === "profile";
  const draftKey = isProfile && profileMember
    ? profileDraftKey(groupId, profileMember.userId)
    : diaryDraftKey(groupId);
  const backHref = isProfile && profileMember
    ? `/groups/${groupId}/profiles/${profileMember.userId}`
    : `/groups/${groupId}`;
  const headerTitle = isProfile ? "プロフィールを書く" : "日記を書く";
  const submitLabel = isProfile ? "プロフィールを保存" : "日記を投稿してバトンを渡す";

  // Canvas dimensions diverge by mode: diary stays at A4 portrait,
  // profile expands to a book-spread (2× wide).
  const canvasWidth = isProfile ? PROFILE_CANVAS_WIDTH : DIARY_CANVAS_WIDTH;
  const canvasHeight = isProfile ? PROFILE_CANVAS_HEIGHT : DIARY_CANVAS_HEIGHT;
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  const [placedMedia, setPlacedMedia] = useState<PlacedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Diary mode only — profile mode skips baton handoff entirely.
  const [allMembersOrdered, setAllMembersOrdered] = useState<{ id: string; name: string; memberOrder: number | null }[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [flipbookData, setFlipbookData] = useState<FlipbookData | null>(null);
  const [flipbookPlacement, setFlipbookPlacement] = useState<PlacedFlipbook | null>(null);
  const [flipbookSelected, setFlipbookSelected] = useState(false);
  const [showFlipbookEditor, setShowFlipbookEditor] = useState(false);
  const [placedStamps, setPlacedStamps] = useState<PlacedStamp[]>([]);
  const [placedTapes, setPlacedTapes] = useState<PlacedTape[]>([]);
  const [placedBlocks, setPlacedBlocks] = useState<PlacedBlock[]>([]);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showTapePicker, setShowTapePicker] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [extraTapeIds, setExtraTapeIds] = useState<TapeId[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedTapeId, setSelectedTapeId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const zCounterRef = useRef(10);
  const nextZ = useCallback(() => ++zCounterRef.current, []);

  const [currentTool, setCurrentTool] = useState<Tool>("select");
  const overlaysInteractive = currentTool === "select";

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
    setSelectedTapeId(null);
    setSelectedBlockId(null);
    setFlipbookSelected(false);
  }, []);

  const handleToolChange = useCallback((t: Tool) => {
    setCurrentTool(t);
    if (t !== "select") {
      setSelectedStampId(null);
      setSelectedMediaId(null);
      setSelectedTapeId(null);
      setSelectedBlockId(null);
      setFlipbookSelected(false);
    }
  }, []);

  const handleSelectStamp = useCallback((id: string | null) => {
    setSelectedStampId(id);
    setSelectedMediaId(null);
    setSelectedTapeId(null);
    setSelectedBlockId(null);
    setFlipbookSelected(false);
    if (id) {
      const z = nextZ();
      setPlacedStamps((prev) => prev.map((s) => (s.instanceId === id ? { ...s, z } : s)));
    }
  }, [nextZ]);

  const handleSelectMedia = useCallback((id: string | null) => {
    setSelectedMediaId(id);
    setSelectedStampId(null);
    setSelectedTapeId(null);
    setSelectedBlockId(null);
    setFlipbookSelected(false);
    if (id) {
      const z = nextZ();
      setPlacedMedia((prev) => prev.map((m) => (m.instanceId === id ? { ...m, z } : m)));
    }
  }, [nextZ]);

  const handleSelectTape = useCallback((id: string | null) => {
    setSelectedTapeId(id);
    setSelectedStampId(null);
    setSelectedMediaId(null);
    setSelectedBlockId(null);
    setFlipbookSelected(false);
    if (id) {
      const z = nextZ();
      setPlacedTapes((prev) => prev.map((t) => (t.instanceId === id ? { ...t, z } : t)));
    }
  }, [nextZ]);

  const handleSelectFlipbook = useCallback(() => {
    setFlipbookSelected(true);
    setSelectedStampId(null);
    setSelectedMediaId(null);
    setSelectedTapeId(null);
    setSelectedBlockId(null);
    const z = nextZ();
    setFlipbookPlacement((prev) => (prev ? { ...prev, z } : prev));
  }, [nextZ]);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    setSelectedStampId(null);
    setSelectedMediaId(null);
    setSelectedTapeId(null);
    setFlipbookSelected(false);
    if (id) {
      const z = nextZ();
      setPlacedBlocks((prev) => prev.map((b) => (b.instanceId === id ? { ...b, z } : b)));
    }
  }, [nextZ]);

  const handleTapePlaced = useCallback(
    (placement: { tapeId: string; x: number; y: number; length: number; rotation: number }) => {
      const instanceId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `tape-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const z = nextZ();
      const next: PlacedTape = { instanceId, ...placement, z };
      setPlacedTapes((prev) => [...prev, next]);
      setSelectedTapeId(instanceId);
      setSelectedStampId(null);
      setSelectedMediaId(null);
      setSelectedBlockId(null);
      setFlipbookSelected(false);
    },
    [nextZ]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<DiaryCanvasHandle>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const stampPickerRef = useRef<HTMLDivElement>(null);
  const tapePickerRef = useRef<HTMLDivElement>(null);
  const blockPickerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!showStampPicker) return;
    stampPickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showStampPicker]);

  useEffect(() => {
    if (!showTapePicker) return;
    tapePickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showTapePicker]);

  useEffect(() => {
    if (!showBlockPicker) return;
    blockPickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showBlockPicker]);

  // Diary mode: load all members so we can derive nextHolder. Profile
  // mode: just resolve the current user id (still needed for storage
  // paths and auth).
  useEffect(() => {
    let mounted = true;
    const loadMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setCurrentUserId(user.id);
      if (isProfile) { setMembersLoaded(true); return; }
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
  }, [groupId, supabase, isProfile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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

      const draft = await loadDraft(draftKey);
      if (cancelled) return;
      if (draft) {
        setInitialSnapshot(draft.diary);
        setPlacedStamps(draft.placedStamps);
        setPlacedTapes(draft.placedTapes ?? []);
        setPlacedBlocks(draft.placedBlocks ?? []);
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
        zCounterRef.current = Math.max(zCounterRef.current, draft.zCounter);
      }
      setDraftLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [groupId, supabase, draftKey]);

  useEffect(() => {
    if (!draftLoaded) return;
    const id = window.setTimeout(() => {
      const diary = latestDiaryRef.current;
      if (!diary) return;
      const draft: Draft = {
        savedAt: Date.now(),
        diary,
        placedStamps,
        placedTapes,
        placedBlocks,
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
      saveDraft(draftKey, draft);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [draftLoaded, diaryVersion, placedStamps, placedTapes, placedBlocks, placedMedia, flipbookData, flipbookPlacement, draftKey]);

  const placementOffset = (index: number) => {
    const k = index % 6;
    return { dx: k * 30 - 60, dy: k * 20 - 40 };
  };

  const countByType = (type: "image" | "video") =>
    placedMedia.filter((m) => m.type === type).length;

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
                x: canvasCenterX + dx,
                y: canvasCenterY + dy,
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
                x: canvasCenterX + dx,
                y: canvasCenterY + dy,
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

  const orderedForNext = allMembersOrdered.filter((m) => m.memberOrder !== null);
  const currentUserIndex = orderedForNext.findIndex((m) => m.id === currentUserId);
  const nextHolder =
    orderedForNext.length > 1 && currentUserIndex !== -1
      ? orderedForNext[(currentUserIndex + 1) % orderedForNext.length]
      : null;

  // In profile mode, the submit button only requires that there's
  // *something* to save — there's no baton to pass, so a single-member
  // group can still publish a profile.
  const canSubmit = isProfile ? true : !!nextHolder;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const canvasEmpty = canvasRef.current?.isEmpty() ?? true;
    if (canvasEmpty && placedMedia.length === 0 && placedStamps.length === 0 && placedTapes.length === 0 && placedBlocks.length === 0 && !flipbookData) {
      setError(isProfile
        ? "ブロックや絵・写真などを追加してください"
        : "日記を書くか画像・動画・スタンプ・パラパラアニメを追加してください");
      return;
    }
    if (!isProfile && !nextHolder) {
      setError("バトンを渡すメンバーがいません。先にグループに招待してください");
      return;
    }
    if (isProfile && !profileMember) {
      setError("プロフィール対象のメンバーが指定されていません");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setLoading(false); return; }

    // Profile mode: replace any existing profile entry for this member
    // before inserting a new one. The unique partial index on (group_id,
    // profile_owner_member_id) where kind='profile' makes a second
    // INSERT fail otherwise. Cascade delete cleans up related rows
    // (entry_blocks / entry_stamps / entry_tapes / entry_media /
    // flipbooks). Old canvas.png blobs stay in storage — acceptable
    // leakage for v1; can be cleaned up by a future maintenance pass.
    if (isProfile && profileMember) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase as any)
        .from("entries")
        .delete()
        .eq("group_id", groupId)
        .eq("kind", "profile")
        .eq("profile_owner_user_id", profileMember.userId);
      if (delErr) {
        console.warn("[ProfileComposer] failed to delete previous profile entry:", delErr);
        // Proceed anyway — the unique index will report the real error
        // on insert if the delete silently failed.
      }
    }

    const canvasBackground = !canvasEmpty ? canvasRef.current?.getBackground() ?? null : null;

    const entryInsert: Record<string, unknown> = {
      group_id: groupId,
      author_id: user.id,
      body: null,
      canvas_background: canvasBackground,
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
    };
    if (isProfile && profileMember) {
      entryInsert.kind = "profile";
      entryInsert.profile_owner_user_id = profileMember.userId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error: entryError } = await (supabase as any).from("entries").insert(entryInsert).select().single();
    if (entryError) { setError(entryError.message); setLoading(false); return; }

    // The handwritten canvas is split into two transparent PNGs:
    //   • canvas.png       — strokes / text on the paper, under media
    //   • canvas-above.png — strokes drawn in foreground mode, on top
    //                        of placed media so the user can scribble
    //                        directly over a photo
    // Either side is omitted when its layer is empty so we don't
    // upload blank PNGs.
    let mediaOrderStart = 0;
    if (!canvasEmpty && canvasRef.current) {
      const { below, above } = await canvasRef.current.exportImages();
      if (below) {
        const path = `${groupId}/${entry.id}/canvas.png`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, below, { contentType: "image/png" });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("entry_media").insert({ entry_id: entry.id, type: "image", url: publicUrl, order: mediaOrderStart });
          mediaOrderStart++;
        }
      }
      if (above) {
        const path = `${groupId}/${entry.id}/canvas-above.png`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, above, { contentType: "image/png" });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("entry_media").insert({ entry_id: entry.id, type: "image", url: publicUrl, order: mediaOrderStart });
          mediaOrderStart++;
        }
      }
    }

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

    if (placedTapes.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_tapes").insert(
        placedTapes.map((t) => ({
          entry_id: entry.id,
          tape_id: t.tapeId,
          x: t.x,
          y: t.y,
          length: t.length,
          rotation: t.rotation,
        }))
      );
    }

    if (placedBlocks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_blocks").insert(
        placedBlocks.map((b) => ({
          entry_id: entry.id,
          block_type: b.blockType,
          x: b.x,
          y: b.y,
          width: b.width,
          rotation: b.rotation,
          data: b.data,
        }))
      );
    }

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

    // Diary-only: pass the baton + fire the notification.
    if (!isProfile && nextHolder) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: passErr } = await (supabase as any).rpc("pass_baton", {
        p_group_id: groupId,
        p_new_holder_id: nextHolder.id,
      });
      if (passErr) console.error("baton pass failed:", passErr);
      triggerBatonNotification(groupId, nextHolder.id);
    }

    await clearDraft(draftKey);

    if (isProfile && profileMember) {
      router.push(`/groups/${groupId}/profiles/${profileMember.userId}`);
    } else {
      router.push(`/groups/${groupId}`);
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link href={backHref} className="text-ink-light hover:text-ink transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold text-ink">
            {headerTitle}
            {isProfile && profileMember && (
              <span className="ml-2 text-ink-light/60 font-normal">
                — {profileMember.name}
              </span>
            )}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        {error && (
          <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div ref={canvasWrapperRef} className="relative scroll-mt-20">
            {!draftLoaded && (
              <div
                style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
                className="w-full max-w-[800px] mx-auto border border-cream-dark rounded-lg bg-white flex items-center justify-center"
              >
                <Loader2 className="size-5 animate-spin text-ink-light" />
              </div>
            )}
            {draftLoaded && (
            <DiaryCanvas
              ref={canvasRef} width={canvasWidth} height={canvasHeight}
              onScaleChange={setCanvasScale}
              onCanvasInteract={clearAllSelections}
              onStampClick={() => setShowStampPicker((v) => !v)}
              stampCount={placedStamps.length}
              onBlockClick={() => setShowBlockPicker((v) => !v)}
              extraTapeIds={extraTapeIds}
              onTapePickerClick={() => setShowTapePicker((v) => !v)}
              initialSnapshot={initialSnapshot}
              onChange={handleDiaryChange}
              onToolChange={handleToolChange}
              onTapePlaced={handleTapePlaced}
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
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      canvasScale={canvasScale}
                      selectedId={selectedStampId}
                      onSelect={handleSelectStamp}
                      interactive={overlaysInteractive}
                    />
                  )}
                  {placedTapes.length > 0 && (
                    <TapeOverlayEditor
                      tapes={placedTapes}
                      onTapesChange={setPlacedTapes}
                      canvasScale={canvasScale}
                      selectedId={selectedTapeId}
                      onSelect={handleSelectTape}
                      interactive={overlaysInteractive}
                    />
                  )}
                  {placedBlocks.length > 0 && (
                    <BlockOverlayEditor
                      blocks={placedBlocks}
                      onBlocksChange={setPlacedBlocks}
                      canvasScale={canvasScale}
                      selectedId={selectedBlockId}
                      onSelect={handleSelectBlock}
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
                        x: canvasCenterX,
                        y: canvasCenterY,
                        scale: 1,
                        rotation: 0,
                        z: nextZ(),
                      },
                    ]);
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
            {showBlockPicker && (
              <div ref={blockPickerRef} className="mt-3 scroll-mt-20">
                <BlockPicker
                  placedBlockTypes={placedBlocks.map((b) => b.blockType)}
                  onSelect={(blockType) => {
                    const instanceId = crypto.randomUUID();
                    const { dx, dy } = placementOffset(placedBlocks.length);
                    setPlacedBlocks((p) => [
                      ...p,
                      {
                        instanceId,
                        blockType,
                        x: canvasCenterX + dx,
                        y: canvasCenterY + dy,
                        width: 320,
                        rotation: 0,
                        data: {},
                        z: nextZ(),
                      },
                    ]);
                    setSelectedBlockId(instanceId);
                    setShowBlockPicker(false);
                    requestAnimationFrame(() => {
                      canvasWrapperRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    });
                  }}
                  onClose={() => setShowBlockPicker(false)}
                />
              </div>
            )}
          </div>

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
                const firstFrame = data.frames[0]?.canvasJson ?? null;
                setFlipbookPlacement((prev) =>
                  prev
                    ? { ...prev, previewDataUrl: firstFrame }
                    : {
                        x: canvasCenterX,
                        y: canvasCenterY,
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

          {/* Baton handoff is diary-only — profile mode skips this
              section entirely so a single-member group can still save
              their profile. */}
          {!isProfile && (
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
          )}

          <Button type="submit" disabled={loading || !canSubmit} className="w-full h-11 bg-moss hover:bg-moss-dark text-base rounded-xl">
            {loading ? <Loader2 className="size-4 animate-spin" /> : submitLabel}
          </Button>
        </form>
      </main>
    </div>
  );
}
