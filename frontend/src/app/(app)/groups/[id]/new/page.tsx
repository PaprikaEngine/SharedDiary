"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { DiaryCanvas } from "@/components/diary-canvas";
import type { DiaryCanvasHandle } from "@/components/diary-canvas";

type ImagePreview = {
  id: string;
  file: File;
  preview: string;
};

export default function NewEntryPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextBatonHolder, setNextBatonHolder] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Get canvas handle from the container element
  const getCanvasHandle = (): DiaryCanvasHandle | null => {
    const container = canvasContainerRef.current?.querySelector(
      "[data-diary-canvas]"
    );
    if (!container) return null;
    return (container as unknown as Record<string, DiaryCanvasHandle>)
      .__diaryCanvas;
  };

  // Load members on mount
  useEffect(() => {
    let mounted = true;

    const loadMembers = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("group_members")
        .select("user:users(id, name)")
        .eq("group_id", groupId);

      if (data && mounted) {
        const memberList = (
          data as { user: { id: string; name: string } | null }[]
        )
          .map((m) => m.user)
          .filter((u): u is { id: string; name: string } => u !== null);
        setMembers(memberList);
        const other = memberList.find((m) => m.id !== user.id);
        setNextBatonHolder(other?.id ?? user.id);
        setMembersLoaded(true);
      }
    };

    loadMembers();

    return () => {
      mounted = false;
    };
  }, [groupId, supabase]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const compressionOptions = {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    for (let i = 0; i < files.length && images.length < 10; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      try {
        const compressedFile = await imageCompression(file, compressionOptions);
        const preview = URL.createObjectURL(compressedFile);

        setImages((prev) => {
          if (prev.length >= 10) return prev;
          return [
            ...prev,
            { id: crypto.randomUUID(), file: compressedFile, preview },
          ];
        });
      } catch (err) {
        console.error("Image compression failed:", err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const handle = getCanvasHandle();
    const canvasEmpty = handle?.isEmpty() ?? true;

    if (canvasEmpty && images.length === 0) {
      setError("日記を書くか画像を追加してください");
      return;
    }

    if (!nextBatonHolder) {
      setError("次のバトンを渡す人を選んでください");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です");
      setLoading(false);
      return;
    }

    // Create entry (body is null since content is in the canvas image)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error: entryError } = await (supabase as any)
      .from("entries")
      .insert({
        group_id: groupId,
        author_id: user.id,
        body: null,
      })
      .select()
      .single();

    if (entryError) {
      setError(entryError.message);
      setLoading(false);
      return;
    }

    // Export and upload canvas image
    if (!canvasEmpty && handle) {
      const blob = await handle.exportImage();
      if (blob) {
        const canvasPath = `${groupId}/${entry.id}/canvas.png`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(canvasPath, blob, { contentType: "image/png" });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("media").getPublicUrl(canvasPath);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("entry_media").insert({
            entry_id: entry.id,
            type: "image",
            url: publicUrl,
            order: 0,
          });
        }
      }
    }

    // Upload attached images
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const path = `${groupId}/${entry.id}/${img.id}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, img.file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("entry_media").insert({
        entry_id: entry.id,
        type: "image",
        url: publicUrl,
        order: (canvasEmpty ? 0 : 1) + i,
      });
    }

    // Update baton holder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("groups")
      .update({ current_baton_holder_id: nextBatonHolder })
      .eq("id", groupId);

    router.push(`/groups/${groupId}`);
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-dark bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href={`/groups/${groupId}`}
            className="text-ink-light hover:text-ink"
          >
            &larr; 戻る
          </Link>
          <h1 className="text-2xl font-bold text-moss">日記を書く</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Canvas Editor */}
          <div ref={canvasContainerRef}>
            <DiaryCanvas width={800} height={600} />
          </div>

          {/* Photo Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-ink">
                写真を添付
              </label>
              <span className="text-sm text-ink-light">
                {images.length}/10
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square">
                  <Image
                    src={img.preview}
                    alt="Preview"
                    fill
                    className="object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-ink text-cream rounded-full text-sm flex items-center justify-center hover:bg-ink-light"
                  >
                    &times;
                  </button>
                </div>
              ))}

              {images.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-cream-dark rounded-lg flex flex-col items-center justify-center hover:border-moss transition-colors"
                >
                  <span className="text-2xl text-ink-light">+</span>
                  <span className="text-xs text-ink-light">写真</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Baton Selection */}
          <div className="bg-white border border-cream-dark rounded-xl p-4">
            <label className="block text-sm font-medium text-ink mb-3">
              次にバトンを渡す人
            </label>
            {membersLoaded ? (
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setNextBatonHolder(member.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      nextBatonHolder === member.id
                        ? "bg-moss text-cream"
                        : "bg-cream-dark text-ink hover:bg-moss/20"
                    }`}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-light">読み込み中...</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moss text-cream px-6 py-4 rounded-xl font-medium text-lg hover:bg-moss-dark transition-colors disabled:opacity-50"
          >
            {loading ? "投稿中..." : "日記を投稿してバトンを渡す"}
          </button>
        </form>
      </main>
    </div>
  );
}
