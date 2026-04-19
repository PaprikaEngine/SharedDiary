"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import { Plus, Loader2, X, Trash2 } from "lucide-react";
import { TAPES, loadTapeFromUrl, registerTape, unregisterTape, type TapeId } from "./tape-patterns";

type TapeRow = {
  id: string;
  name: string;
  image_url: string;
  created_by: string | null;
};

type Props = {
  groupId: string;
  onClose: () => void;
  /** Called after a new tape is uploaded and registered, so the parent
   *  can include its id in `extraTapeIds`. */
  onTapeAdded?: (id: TapeId) => void;
  /** Called after a tape is deleted, so the parent can drop its id. */
  onTapeRemoved?: (id: TapeId) => void;
  currentUserId: string | null;
};

export function TapePicker({ groupId, onClose, onTapeAdded, onTapeRemoved, currentUserId }: Props) {
  const [tapes, setTapes] = useState<TapeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("tapes")
      .select("id, name, image_url, created_by")
      .eq("scope", "group")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    const rows = (data as TapeRow[] | null) ?? [];
    setTapes(rows);
    setLoading(false);

    // Make sure each row is in the runtime registry — the toolbar
    // pulls swatches straight from TAPES, so we have to register
    // anything that isn't there yet.
    for (const r of rows) {
      if (TAPES[r.id]) continue;
      const def = await loadTapeFromUrl({
        id: r.id,
        label: r.name,
        url: r.image_url,
        scope: "group",
      });
      if (def) {
        registerTape(def);
        onTapeAdded?.(def.id);
      }
    }
  }, [groupId, supabase, onTapeAdded]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    setError(null);
    setUploading(true);
    try {
      const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
      if (!allowed.includes(file.type)) {
        setError("PNG / JPEG / WebP / GIF のみ対応しています");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("ログインが必要です"); return; }

      // Compress unless GIF (preserve animation in case of future
      // animated-tape support; today GIF is treated as a single frame).
      const isGif = file.type === "image/gif";
      const processed = isGif
        ? file
        : await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 512, useWebWorker: true });

      const tapeId = crypto.randomUUID();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `tapes/${groupId}/${tapeId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, processed, { contentType: file.type });
      if (upErr) { setError(upErr.message); return; }

      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "テープ";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertErr } = await (supabase as any).from("tapes").insert({
        id: tapeId,
        name,
        image_url: publicUrl,
        scope: "group",
        group_id: groupId,
        created_by: user.id,
      });
      if (insertErr) { setError(insertErr.message); return; }

      const def = await loadTapeFromUrl({ id: tapeId, label: name, url: publicUrl, scope: "group" });
      if (def) {
        registerTape(def);
        onTapeAdded?.(def.id);
      }
      await load();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このテープを削除しますか?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (supabase as any).from("tapes").delete().eq("id", id);
    if (delErr) { setError(delErr.message); return; }
    unregisterTape(id);
    onTapeRemoved?.(id);
    await load();
  };

  return (
    <div className="card p-5 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-medium t-hi">マスキングテープを追加</h3>
        <button
          type="button"
          onClick={onClose}
          className="t-lo hover:t-hi"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </button>
      </div>

      {error && (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded border"
          style={{
            borderColor: "var(--danger)",
            color: "var(--danger)",
            background: "var(--danger-soft)",
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
        {tapes.map((t) => {
          const def = TAPES[t.id];
          const canDelete = currentUserId && t.created_by === currentUserId;
          return (
            <div key={t.id} className="relative group">
              <div
                className="w-full h-12 rounded border border-cream-dark"
                style={{
                  backgroundImage: def?.tile ? `url(${def.tile.toDataURL()})` : undefined,
                  backgroundRepeat: "repeat",
                  backgroundSize: "auto 100%",
                }}
                title={t.name}
              />
              <p className="text-[11px] t-md mt-1.5 truncate" title={t.name}>{t.name}</p>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  style={{ background: "var(--ink)", color: "var(--paper)" }}
                  title="削除"
                  aria-label="削除"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          );
        })}

        {!loading && tapes.length === 0 && (
          <p className="col-span-full text-[12px] t-lo py-2 text-center">
            まだテープがありません
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="meta-sm">横長の画像が綺麗に repeat します (推奨 256×40px 程度)</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn btn-ghost btn-sm shrink-0"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {uploading ? "アップロード中..." : "テープ画像を選ぶ"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
