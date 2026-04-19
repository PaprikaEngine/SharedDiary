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
  const canvasRef = useRef<DiaryCanvasHandle>(null);
  const router = useRouter();
  const supabase = createClient();

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

    const canvasEmpty = canvasRef.current?.isEmpty() ?? true;

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
    if (!canvasEmpty && canvasRef.current) {
      const blob = await canvasRef.current.exportImage();
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
      <header className="sticky top-0 z-10 border-b rule-hair" style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-5xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/groups/${groupId}`} className="btn btn-flat btn-sm">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M11 7H3M3 7L6.5 3.5M3 7L6.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              戻る
            </Link>
            <span className="t-xlo">/</span>
            <span className="meta">New entry</span>
          </div>
          <button type="submit" form="new-entry-form" disabled={loading} className="btn btn-primary btn-sm">
            {loading ? "投稿中..." : "投稿してバトンを渡す"}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-10 reveal reveal-1">
        <div className="mb-8">
          <h1 className="text-[28px] font-medium tracking-[-0.02em] t-hi leading-tight">日記を書く</h1>
          <p className="mt-1.5 text-[13.5px] t-md">書き終えたら、次に渡す人を選びます。</p>
        </div>

        {error && (
          <div className="mb-6 text-[13px] px-3.5 py-2.5 rounded-[8px] border" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}>
            {error}
          </div>
        )}

        <form id="new-entry-form" onSubmit={handleSubmit} className="space-y-8">
          {/* Canvas Editor */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="chip chip-ink">1</span>
                <span className="text-[14px] font-medium t-hi">キャンバス</span>
              </div>
              <span className="meta-sm">ペン・消しゴム・テキスト</span>
            </div>
            <DiaryCanvas ref={canvasRef} width={800} height={600} />
          </section>

          {/* Photo Attachments */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="chip chip-ink">2</span>
                <span className="text-[14px] font-medium t-hi">写真</span>
              </div>
              <span className="meta-sm">{images.length} / 10</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-[10px] overflow-hidden border" style={{ borderColor: "var(--stroke)" }}>
                  <Image
                    src={img.preview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px]"
                    style={{ background: "rgba(24,24,22,0.85)", color: "var(--paper)" }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}

              {images.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-[10px] flex flex-col items-center justify-center gap-1.5 transition-all"
                  style={{ background: "var(--paper-alt)", border: "1px dashed var(--stroke-strong)", color: "var(--ink-2)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span className="text-[11px] t-md font-medium">写真を追加</span>
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
          </section>

          {/* Baton Selection */}
          <section className="card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="chip chip-ink">3</span>
              <span className="text-[14px] font-medium t-hi">次にバトンを渡す人</span>
            </div>

            {membersLoaded ? (
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const active = nextBatonHolder === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setNextBatonHolder(member.id)}
                      className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all"
                      style={
                        active
                          ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }
                          : { background: "var(--paper)", borderColor: "var(--stroke)", color: "var(--ink)" }
                      }
                    >
                      <span className="avatar" style={active ? { background: "var(--paper)", color: "var(--ink)", borderColor: "transparent" } : undefined}>
                        {member.name.charAt(0)}
                      </span>
                      <span className="text-[13px] font-medium">{member.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] t-md">読み込み中...</p>
            )}
          </section>

          {/* Footer action for mobile / tall viewports */}
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
            {loading ? "投稿中..." : "投稿してバトンを渡す"}
          </button>
        </form>
      </main>
    </div>
  );
}
