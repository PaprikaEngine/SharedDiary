"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { validateVideo } from "@/lib/video-utils";
import { triggerBatonNotification } from "@/lib/notifications";
import { DiaryCanvas } from "@/components/diary-canvas";
import type { DiaryCanvasHandle } from "@/components/diary-canvas";
import { StampPicker, StampOverlayEditor, MAX_STAMPS } from "@/components/stamps";
import type { PlacedStamp } from "@/components/stamps";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImagePlus, Film, Loader2, X } from "lucide-react";

type ImagePreview = { id: string; file: File; preview: string };
type VideoPreview = { id: string; file: File; preview: string; duration: number };

export default function NewEntryPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextBatonHolder, setNextBatonHolder] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [videos, setVideos] = useState<VideoPreview[]>([]);
  const [placedStamps, setPlacedStamps] = useState<PlacedStamp[]>([]);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<DiaryCanvasHandle>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    const loadMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("group_members").select("user:users(id, name)").eq("group_id", groupId);
      if (data && mounted) {
        const list = (data as { user: { id: string; name: string } | null }[]).map((m) => m.user).filter((u): u is { id: string; name: string } => u !== null);
        setMembers(list);
        setNextBatonHolder(list.find((m) => m.id !== user.id)?.id ?? user.id);
        setMembersLoaded(true);
      }
    };
    loadMembers();
    return () => { mounted = false; };
  }, [groupId, supabase]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length && images.length < 10; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
        const preview = URL.createObjectURL(compressed);
        setImages((prev) => prev.length >= 10 ? prev : [...prev, { id: crypto.randomUUID(), file: compressed, preview }]);
      } catch (err) { console.error("Image compression failed:", err); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => { const img = prev.find((i) => i.id === id); if (img) URL.revokeObjectURL(img.preview); return prev.filter((i) => i.id !== id); });
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length && videos.length + i < 3; i++) {
      const file = files[i];
      const result = await validateVideo(file);
      if (!result.valid) { setError(result.error); continue; }
      const preview = URL.createObjectURL(file);
      setVideos((prev) => prev.length >= 3 ? prev : [...prev, { id: crypto.randomUUID(), file, preview, duration: result.duration }]);
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const removeVideo = (id: string) => {
    setVideos((prev) => { const v = prev.find((i) => i.id === id); if (v) URL.revokeObjectURL(v.preview); return prev.filter((i) => i.id !== id); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const canvasEmpty = canvasRef.current?.isEmpty() ?? true;
    if (canvasEmpty && images.length === 0 && videos.length === 0 && placedStamps.length === 0) { setError("日記を書くか画像・動画・スタンプを追加してください"); return; }
    if (!nextBatonHolder) { setError("次のバトンを渡す人を選んでください"); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error: entryError } = await (supabase as any).from("entries").insert({ group_id: groupId, author_id: user.id, body: null }).select().single();
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

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const path = `${groupId}/${entry.id}/${img.id}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, img.file);
      if (upErr) { console.error(upErr); continue; }
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_media").insert({ entry_id: entry.id, type: "image", url: publicUrl, order: (canvasEmpty ? 0 : 1) + i });
    }

    const videoOrderStart = (canvasEmpty ? 0 : 1) + images.length;
    for (let i = 0; i < videos.length; i++) {
      const vid = videos[i];
      const path = `${groupId}/${entry.id}/video/${vid.id}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, vid.file, { contentType: vid.file.type });
      if (upErr) { console.error(upErr); continue; }
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_media").insert({ entry_id: entry.id, type: "video", url: publicUrl, order: videoOrderStart + i });
    }

    if (placedStamps.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_stamps").insert(placedStamps.map((s) => ({ entry_id: entry.id, stamp_id: s.stampId, x: s.x, y: s.y, scale: s.scale, rotation: s.rotation })));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("groups").update({ current_baton_holder_id: nextBatonHolder }).eq("id", groupId);
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
          <div className="relative">
            <DiaryCanvas
              ref={canvasRef} width={800} height={600}
              onScaleChange={setCanvasScale}
              onStampClick={() => setShowStampPicker((v) => !v)}
              stampCount={placedStamps.length}
              stampOverlay={placedStamps.length > 0 ? (
                <StampOverlayEditor stamps={placedStamps} onStampsChange={setPlacedStamps} canvasWidth={800} canvasHeight={600} canvasScale={canvasScale} />
              ) : null}
            />
            {showStampPicker && (
              <div className="mt-3">
                <StampPicker groupId={groupId} onSelect={(stamp) => {
                  if (placedStamps.length >= MAX_STAMPS) return;
                  setPlacedStamps((p) => [...p, { instanceId: crypto.randomUUID(), stampId: stamp.id, url: stamp.url, x: 400, y: 300, scale: 1, rotation: 0 }]);
                }} onClose={() => setShowStampPicker(false)} />
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="paper-plain rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-ink-light">写真を添付</span>
              <span className="text-xs text-ink-light/50">{images.length}/10</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square group rounded-lg overflow-hidden">
                  <Image src={img.preview} alt="" fill className="object-cover" />
                  <button type="button" onClick={() => removeImage(img.id)} className="absolute top-1 right-1 size-5 bg-ink/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {images.length < 10 && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square border border-dashed border-cream-dark rounded-lg flex items-center justify-center hover:border-moss/40 transition-colors">
                  <ImagePlus className="size-4 text-ink-light/40" />
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
          </div>

          {/* Videos */}
          <div className="paper-plain rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-ink-light">動画を添付</span>
              <span className="text-xs text-ink-light/50">{videos.length}/3</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {videos.map((vid) => (
                <div key={vid.id} className="relative aspect-video group rounded-lg overflow-hidden bg-ink/5">
                  <video src={vid.preview} className="w-full h-full object-cover" preload="metadata" muted />
                  <div className="absolute bottom-1 left-1 bg-ink/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {Math.floor(vid.duration / 60)}:{String(Math.floor(vid.duration % 60)).padStart(2, "0")}
                  </div>
                  <button type="button" onClick={() => removeVideo(vid.id)} className="absolute top-1 right-1 size-5 bg-ink/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {videos.length < 3 && (
                <button type="button" onClick={() => videoInputRef.current?.click()} className="aspect-video border border-dashed border-cream-dark rounded-lg flex items-center justify-center hover:border-moss/40 transition-colors">
                  <Film className="size-4 text-ink-light/40" />
                </button>
              )}
            </div>
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" multiple onChange={handleVideoSelect} className="hidden" />
          </div>

          {/* Baton */}
          <div className="paper-plain rounded-xl p-4">
            <span className="block text-xs font-medium text-ink-light mb-2">次にバトンを渡す人</span>
            {membersLoaded ? (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.id} type="button" onClick={() => setNextBatonHolder(m.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${nextBatonHolder === m.id ? "bg-moss text-white" : "bg-cream-dark/60 text-ink-light hover:bg-cream-dark"}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-light/50">読み込み中...</p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading} className="w-full h-11 bg-moss hover:bg-moss-dark text-base rounded-xl">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "日記を投稿してバトンを渡す"}
          </Button>
        </form>
      </main>
    </div>
  );
}
