"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ImagePlus, X } from "lucide-react";

export default function NewGroupPage() {
  const [name, setName] = useState("");
  const [batonDeadlineDays, setBatonDeadlineDays] = useState("3");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      setCoverFile(compressed);
      setCoverPreview(URL.createObjectURL(compressed));
    } catch {
      setError("画像の読み込みに失敗しました");
    }
  };

  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("groups")
      .insert({ name, baton_deadline_days: Number(batonDeadlineDays), created_by: user.id })
      .select()
      .single();

    if (error) { setError(error.message); setLoading(false); return; }

    if (coverFile) {
      const coverPath = `${data.id}/cover`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(coverPath, coverFile, { contentType: coverFile.type, upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(coverPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("groups").update({ cover_image: publicUrl }).eq("id", data.id);
      }
    }

    router.push(`/groups/${data.id}`);
    router.refresh();
  };

  const options = [
    { v: "1", l: "1日" },
    { v: "3", l: "3日" },
    { v: "7", l: "1週間" },
    { v: "14", l: "2週間" },
    { v: "30", l: "1ヶ月" },
  ];

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b rule-hair"
        style={{
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link href="/groups" className="btn btn-flat btn-sm">
            <ArrowLeft className="size-4" strokeWidth={1.6} />
            Library
          </Link>
          <span className="meta">New diary</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 md:px-10 py-12 reveal reveal-1">
        <h1 className="text-[28px] font-medium tracking-[-0.02em] t-hi mb-1.5">新しい日記帳</h1>
        <p className="text-[13.5px] t-md mb-9">名前を決めるだけ。仲間は後から招待できます。</p>

        {error && (
          <div
            className="mb-6 text-[13px] px-3.5 py-2.5 rounded-[8px] border"
            style={{
              borderColor: "var(--danger)",
              color: "var(--danger)",
              background: "var(--danger-soft)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Cover image (optional) */}
          <div>
            <label className="block text-[13px] font-medium t-hi mb-2">
              表紙 <span className="t-lo font-normal">(任意)</span>
            </label>
            <div
              onClick={() => coverInputRef.current?.click()}
              className="relative w-full h-44 rounded-[10px] border border-dashed cursor-pointer overflow-hidden hover:border-[var(--ink-3)] transition-colors"
              style={{ borderColor: "var(--stroke-strong)", background: "var(--paper-alt)" }}
            >
              {coverPreview ? (
                <>
                  <Image src={coverPreview} alt="表紙プレビュー" fill className="object-cover" sizes="(max-width: 768px) 100vw, 720px" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeCover(); }}
                    className="absolute top-2 right-2 size-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(24,24,22,0.85)", color: "var(--paper)" }}
                    aria-label="削除"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: "var(--ink-3)" }}>
                  <ImagePlus className="size-5" strokeWidth={1.5} />
                  <span className="text-[12.5px] t-md">タップして画像を選ぶ</span>
                </div>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverSelect}
              className="hidden"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-[13px] font-medium t-hi mb-2">
              日記帳の名前
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              placeholder="例: 高校の友達との日記"
              className="field field-lg"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium t-hi mb-2">
              バトンの期限
            </label>
            <div className="seg w-full">
              {options.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setBatonDeadlineDays(opt.v)}
                  data-active={batonDeadlineDays === opt.v}
                  className="flex-1"
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] t-lo">
              バトンを受けた人が書くまでの期限です。
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn btn-primary btn-lg"
            >
              {loading ? "作成中..." : "日記帳を作成"}
            </button>
            <Link href="/groups" className="btn btn-flat btn-lg">
              キャンセル
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
