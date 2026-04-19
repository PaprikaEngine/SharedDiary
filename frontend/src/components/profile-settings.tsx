"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ImagePlus, Trash2 } from "lucide-react";

export function ProfileSettings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("name, avatar_url")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      const row = data as { name: string; avatar_url: string | null } | null;
      const currentName = row?.name ?? "";
      setUserId(user.id);
      setName(currentName);
      setInitialName(currentName);
      setAvatarUrl(row?.avatar_url ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      // Avatars render small — a 512px square source keeps storage minimal.
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });
      const normalized = new File([compressed], file.name, { type: compressed.type || file.type });
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingFile(normalized);
      setPendingPreview(URL.createObjectURL(normalized));
      setRemoveAvatar(false);
      setError(null);
    } catch (err) {
      console.error("avatar compression failed:", err);
      setError("画像の処理に失敗しました");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAvatar = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setRemoveAvatar(true);
  };

  // Walk every file under `{user_id}/` so replacing/removing the
  // avatar doesn't leave orphans in the bucket.
  const listAvatarFiles = async (uid: string): Promise<string[]> => {
    const { data } = await supabase.storage.from("avatars").list(uid, { limit: 100 });
    if (!data) return [];
    return data.filter((f) => f.id !== null).map((f) => `${uid}/${f.name}`);
  };

  const handleSave = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError("名前を入力してください"); return; }
    if (trimmed.length > 30) { setError("30文字以内にしてください"); return; }
    if (!userId) { setError("ログインが必要です"); return; }
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (trimmed !== initialName) updates.name = trimmed;

    if (pendingFile) {
      const ext = (pendingFile.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `avatar-${Date.now()}.${ext}`;
      const path = `${userId}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      updates.avatar_url = publicUrl;
      try {
        const all = await listAvatarFiles(userId);
        const stale = all.filter((p) => !p.endsWith(`/${fileName}`));
        if (stale.length > 0) await supabase.storage.from("avatars").remove(stale);
      } catch (err) {
        console.error("avatar cleanup failed:", err);
      }
    } else if (removeAvatar) {
      updates.avatar_url = null;
      try {
        const all = await listAvatarFiles(userId);
        if (all.length > 0) await supabase.storage.from("avatars").remove(all);
      } catch (err) {
        console.error("avatar cleanup failed:", err);
      }
    }

    if (Object.keys(updates).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upErr } = await (supabase as any)
        .from("users")
        .update(updates)
        .eq("id", userId);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    }

    if ("avatar_url" in updates) {
      setAvatarUrl(updates.avatar_url ?? null);
    }
    if ("name" in updates) {
      setInitialName(trimmed);
    }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setRemoveAvatar(false);
    setSavedAt(Date.now());
    setSaving(false);
  };

  if (loading) {
    return <p className="text-sm text-ink-light">読み込み中...</p>;
  }

  const nameDirty = name.trim() !== initialName;
  const avatarDirty = pendingFile !== null || removeAvatar;
  const dirty = nameDirty || avatarDirty;

  // Display precedence: pending pick > current saved avatar
  // (unless the user clicked "外す") > initial placeholder.
  const displayAvatarUrl = pendingPreview ?? (removeAvatar ? null : avatarUrl);
  const initialChar = (name.trim() || "?").charAt(0);

  return (
    <div className="paper-plain rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-moss/15 text-moss text-xl font-bold flex items-center justify-center overflow-hidden shrink-0">
          {displayAvatarUrl ? (
            <Image src={displayAvatarUrl} alt="" width={64} height={64} className="size-16 object-cover" unoptimized />
          ) : (
            initialChar
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickAvatar}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="h-8 text-xs gap-1.5"
            >
              <ImagePlus className="size-3.5" />
              画像を選ぶ
            </Button>
            {(avatarUrl || pendingFile) && !removeAvatar && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemoveAvatar}
                disabled={saving}
                className="h-8 text-xs gap-1.5 text-red-500 hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
                外す
              </Button>
            )}
          </div>
        </div>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-ink-light mb-1.5">表示名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="w-full h-10 px-3 bg-white border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-moss/60"
          placeholder="名前"
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-9 bg-moss hover:bg-moss-dark text-xs rounded-lg px-4"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "保存"}
        </Button>
        {savedAt && !dirty && (
          <span className="flex items-center gap-1 text-xs text-moss">
            <Check className="size-3.5" /> 保存しました
          </span>
        )}
      </div>
    </div>
  );
}
