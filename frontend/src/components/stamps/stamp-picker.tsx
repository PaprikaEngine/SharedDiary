"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { LottieStamp } from "./lottie-stamp";
import imageCompression from "browser-image-compression";
import { Plus, Loader2, AlertCircle } from "lucide-react";

type Stamp = {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
};

type Props = {
  groupId?: string;
  onSelect: (stamp: Stamp) => void;
  onClose: () => void;
  compact?: boolean;
};

export function StampPicker({ groupId, onSelect, onClose, compact = false }: Props) {
  const [builtinStamps, setBuiltinStamps] = useState<Stamp[]>([]);
  const [groupStamps, setGroupStamps] = useState<Stamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"builtin" | "group">("builtin");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadStamps = useCallback(async () => {
    const { data: builtinData } = await supabase
      .from("stamps")
      .select("id, name, type, url, thumbnail_url")
      .eq("scope", "builtin")
      .order("name");
    setBuiltinStamps((builtinData as Stamp[] | null) ?? []);

    if (groupId) {
      const { data: groupData } = await supabase
        .from("stamps")
        .select("id, name, type, url, thumbnail_url")
        .eq("scope", "group")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      setGroupStamps((groupData as Stamp[] | null) ?? []);
    }
    setLoading(false);
  }, [groupId, supabase]);

  useEffect(() => { loadStamps(); }, [loadStamps]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);

    const allowed = ["image/png", "image/gif", "image/webp", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      setError("PNG / GIF / WebP / JPEG のみ対応しています");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("ログインが必要です"); return; }

      // Compress if not GIF (preserve GIF animation)
      const isGif = file.type === "image/gif";
      const processed = isGif ? file : await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 256, useWebWorker: true });

      const stampId = crypto.randomUUID();
      const ext = file.name.split(".").pop() || "png";
      // groupId-first path — the storage RLS policy extracts the group
      // id from the first folder via foldername(name)[1]::uuid, so
      // anything else as the first segment fails the cast.
      const path = `${groupId}/stamps/${stampId}.${ext}`;

      const { error: upErr } = await supabase.storage.from("media").upload(path, processed, { contentType: file.type });
      if (upErr) { setError(upErr.message); return; }

      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "カスタム";
      const stampType = isGif ? "apng" : "webp";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertErr } = await (supabase as any).from("stamps").insert({
        name,
        type: stampType,
        url: publicUrl,
        thumbnail_url: publicUrl,
        scope: "group",
        group_id: groupId,
        created_by: user.id,
      });
      if (insertErr) { setError(insertErr.message); return; }

      await loadStamps();
      setTab("group");
    } finally {
      setUploading(false);
    }
  };

  const stamps = tab === "builtin" ? builtinStamps : groupStamps;
  const stampSize = compact ? 48 : 56;

  return (
    <div className={`bg-white border border-cream-dark rounded-xl shadow-lg ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-medium text-ink ${compact ? "text-sm" : "text-base"}`}>
          スタンプ
        </h3>
        <button type="button" onClick={onClose} className="text-ink-light hover:text-ink text-lg leading-none">
          &times;
        </button>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 mb-3 px-3 py-2 rounded-md text-[12.5px]"
          style={{ color: "var(--danger)", background: "var(--danger-soft)" }}
          role="alert"
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0" strokeWidth={1.6} />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Tabs */}
      {groupId && (
        <div className="flex items-center gap-1 mb-3">
          <button type="button" onClick={() => setTab("builtin")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${tab === "builtin" ? "bg-moss/10 text-moss font-medium" : "text-ink-light hover:bg-cream-dark/40"}`}>
            組み込み
          </button>
          <button type="button" onClick={() => setTab("group")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${tab === "group" ? "bg-moss/10 text-moss font-medium" : "text-ink-light hover:bg-cream-dark/40"}`}>
            グループ {groupStamps.length > 0 && <span className="ml-0.5 text-[10px]">({groupStamps.length})</span>}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-light py-4 text-center">読み込み中...</p>
      ) : (
        <div className={`grid gap-2 ${compact ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-6"}`}>
          {stamps.map((stamp) => (
            <button
              key={stamp.id}
              type="button"
              onClick={() => onSelect(stamp)}
              className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-cream-dark/50 transition-colors"
              title={stamp.name}
            >
              <LottieStamp url={stamp.url} thumbnailUrl={stamp.thumbnail_url} width={stampSize} height={stampSize} />
              {!compact && (
                <span className="text-xs text-ink-light truncate w-full text-center">{stamp.name}</span>
              )}
            </button>
          ))}

          {/* Upload button (group tab only) */}
          {tab === "group" && groupId && (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex flex-col items-center justify-center gap-1 p-1 rounded-lg border border-dashed border-cream-dark hover:border-moss/40 transition-colors"
              style={{ minHeight: stampSize + 16 }}>
              {uploading
                ? <Loader2 className="size-5 animate-spin text-ink-light/40" />
                : <Plus className="size-5 text-ink-light/40" />}
              {!compact && <span className="text-[10px] text-ink-light/50">追加</span>}
            </button>
          )}

          {stamps.length === 0 && tab === "builtin" && (
            <p className="col-span-full text-sm text-ink-light py-2 text-center">スタンプがありません</p>
          )}
          {stamps.length === 0 && tab === "group" && !uploading && (
            <p className="col-span-full text-xs text-ink-light/50 py-2 text-center">画像をアップロードしてグループスタンプを作ろう</p>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/png,image/gif,image/webp,image/jpeg" onChange={handleUpload} className="hidden" />
    </div>
  );
}
