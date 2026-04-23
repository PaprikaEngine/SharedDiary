"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import { Loader2, X, Trash2, Upload, AlertCircle } from "lucide-react";
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

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function TapePicker({ groupId, onClose, onTapeAdded, onTapeRemoved, currentUserId }: Props) {
  const [tapes, setTapes] = useState<TapeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline delete confirmation — native confirm() is too jarring for this
  // craft-tray aesthetic. Holds the id of the tape pending delete.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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

  const ingestFile = async (file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("PNG / JPEG / WebP / GIF のみ対応しています");
      return;
    }
    setUploading(true);
    try {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (file) await ingestFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await ingestFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (supabase as any).from("tapes").delete().eq("id", id);
    if (delErr) { setError(delErr.message); return; }
    unregisterTape(id);
    onTapeRemoved?.(id);
    await load();
  };

  const isEmpty = !loading && tapes.length === 0;

  return (
    <div className="card w-full max-w-[800px] mx-auto overflow-hidden">
      {/* Header — editorial craft mark + count + close */}
      <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b rule-hair">
        <div className="flex items-center gap-3 min-w-0">
          {/* Tiny tape glyph — gives the panel a craft mark without
              adding a real icon. Diagonal strip echoes a piece of tape. */}
          <span
            className="inline-block size-2.5 rounded-[2px] shrink-0"
            style={{
              background: "var(--signal)",
              transform: "rotate(-18deg)",
              boxShadow: "0 0 0 3px var(--signal-soft)",
            }}
            aria-hidden
          />
          <h3 className="text-[14.5px] font-medium tracking-tight t-hi">
            マスキングテープ
          </h3>
          <span className="meta-sm hidden sm:inline">{tapes.length} in collection</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="t-lo hover:t-hi transition-colors -mr-1 p-1"
          aria-label="閉じる"
        >
          <X className="size-4" strokeWidth={1.6} />
        </button>
      </header>

      {error && (
        <div
          className="flex items-start gap-2 px-5 sm:px-6 py-3 border-b rule-hair text-[12.5px]"
          style={{
            color: "var(--danger)",
            background: "var(--danger-soft)",
          }}
          role="alert"
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0" strokeWidth={1.6} />
          <span>{error}</span>
        </div>
      )}

      {/* Tape rack — each row is a horizontal strip so the texture reads
          like real tape. Empty state collapses the rack and lets the
          dropzone below carry the conversation. */}
      {!isEmpty && (
        <ul className="divide-y rule-hair" style={{ borderColor: "var(--stroke)" }}>
          {tapes.map((t) => {
            const def = TAPES[t.id];
            const canDelete = !!currentUserId && t.created_by === currentUserId;
            const isPending = pendingDelete === t.id;

            return (
              <li
                key={t.id}
                className="flex items-center gap-4 px-5 sm:px-6 py-3 transition-colors"
                style={{ background: isPending ? "var(--danger-soft)" : undefined }}
              >
                {/* Tape strip swatch — fills the row so the user can
                    see the actual on-page proportions. */}
                <div
                  className="flex-1 min-w-0 h-9 sm:h-10 rounded-[3px]"
                  style={{
                    backgroundImage: def?.tile ? `url(${def.tile.toDataURL()})` : undefined,
                    backgroundColor: "var(--paper-alt)",
                    backgroundRepeat: "repeat",
                    backgroundSize: "auto 100%",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
                  }}
                  title={t.name}
                />

                <div className="flex flex-col gap-0.5 min-w-[80px] max-w-[40%]">
                  <span className="text-[12.5px] font-medium t-hi truncate" title={t.name}>
                    {t.name}
                  </span>
                  {!canDelete && (
                    <span className="meta-sm">グループ共有</span>
                  )}
                </div>

                {canDelete && (
                  isPending ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="text-[12px] t-md hover:t-hi px-2 py-1"
                      >
                        やめる
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="text-[12px] font-medium px-2.5 py-1 rounded-[6px]"
                        style={{
                          background: "var(--danger)",
                          color: "var(--paper)",
                        }}
                      >
                        削除する
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(t.id)}
                      className="t-lo hover:opacity-100 opacity-50 hover:text-[var(--danger)] transition-all p-1.5 -m-1.5 shrink-0"
                      title="削除"
                      aria-label={`${t.name} を削除`}
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {loading && (
        <div className="px-5 sm:px-6 py-6 flex items-center justify-center">
          <Loader2 className="size-4 animate-spin" style={{ color: "var(--ink-3)" }} />
        </div>
      )}

      {/* Dropzone CTA — the primary action. Real drag-and-drop, not just
          a button. Larger / more inviting on empty state. */}
      <div
        className="px-5 sm:px-6 pt-4 pb-5"
        style={{ background: "var(--paper-alt)" }}
      >
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="block rounded-[10px] cursor-pointer transition-all"
          style={{
            border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--stroke-strong)"}`,
            background: dragOver ? "var(--accent-soft)" : "var(--paper)",
            padding: isEmpty ? "32px 20px" : "22px 20px",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          <div className="flex flex-col items-center gap-2.5 text-center">
            <div
              className="size-10 rounded-full flex items-center justify-center"
              style={{
                background: dragOver ? "var(--accent)" : "var(--paper-alt)",
                color: dragOver ? "var(--paper)" : "var(--ink-2)",
                transition: "background 160ms ease, color 160ms ease",
              }}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" strokeWidth={1.6} />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium t-hi">
                {uploading
                  ? "アップロード中..."
                  : dragOver
                  ? "ここに置いて離す"
                  : isEmpty
                  ? "最初のテープを追加する"
                  : "新しいテープを追加する"}
              </span>
              <span className="meta-sm">
                ドラッグ&ドロップ・タップで選択 &nbsp;·&nbsp; 横長 256×40 推奨
              </span>
            </div>
          </div>
        </label>
      </div>

      {/* Footer rule reinforcing where the tape will appear */}
      <footer
        className="px-5 sm:px-6 py-2.5 border-t rule-hair flex items-center justify-between"
      >
        <span className="meta-sm">PNG / JPEG / WebP / GIF</span>
        <span className="meta-sm">グループ全員が使えます</span>
      </footer>
    </div>
  );
}
