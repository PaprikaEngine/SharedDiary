import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { EntryStampsDisplay } from "./entry-stamps-display";
import { ReactionBar } from "./reaction-bar";
import { EntryTapesDisplay } from "./entry-tapes-display";
import { EntryBlocksDisplay } from "./entry-blocks-display";
import { FlipbookPlayer } from "@/components/flipbook";

type Props = { params: Promise<{ id: string; entryId: string }> };
const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function EntryPage({ params }: Props) {
  const { id: groupId, entryId } = await params;

  type EntryWithRelations = {
    id: string; group_id: string; author_id: string; body: string | null; created_at: string;
    canvas_width: number | null; canvas_height: number | null;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
  };
  type EntryStampData = { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } };
  type ReactionData = { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } };
  type EntryTapeData = { id: string; tape_id: string; x: number; y: number; length: number; rotation: number; image_url: string | null };
  type EntryBlockData = { id: string; block_type: string; x: number; y: number; width: number; rotation: number; data: Record<string, string> };

  let entry: EntryWithRelations = {
    id: entryId,
    group_id: groupId,
    author_id: "demo",
    body: "今日はいい天気だったね。公園でアイスを食べたよ。\n\nまた明日も遊ぼうね。",
    created_at: new Date().toISOString(),
    canvas_width: null, canvas_height: null,
    author: { id: "demo", name: "ともだち", avatar_url: null }, media: null,
  };
  let prevEntry: { id: string } | null = null;
  let nextEntry: { id: string } | null = null;
  let entryStamps: EntryStampData[] = [];
  let reactions: ReactionData[] = [];
  let entryTapes: EntryTapeData[] = [];
  let entryBlocks: EntryBlockData[] = [];
  let flipbook: { fps: number; loop: boolean; frames: { order: number; canvasJson: string }[] } | null = null;
  let currentUserId: string | null = null;

  if (!isDemo) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");

      const { data: membership } = await supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).single();
      if (!membership) notFound();

      const { data: entryData } = await supabase.from("entries").select(`*, author:users(id, name, avatar_url), media:entry_media(id, type, url, order, width, height)`).eq("id", entryId).eq("group_id", groupId).single();
      if (!entryData) notFound();
      entry = entryData as EntryWithRelations;

      const c = entry.created_at;
      const { data: p } = await supabase.from("entries").select("id").eq("group_id", groupId).lt("created_at", c).order("created_at", { ascending: false }).limit(1).single();
      const { data: n } = await supabase.from("entries").select("id").eq("group_id", groupId).gt("created_at", c).order("created_at", { ascending: true }).limit(1).single();
      prevEntry = p as { id: string } | null;
      nextEntry = n as { id: string } | null;
      currentUserId = user.id;

      const { data: sd } = await supabase.from("entry_stamps").select(`id, x, y, scale, rotation, stamp:stamps(url, thumbnail_url)`).eq("entry_id", entryId);
      if (sd) entryStamps = sd as unknown as EntryStampData[];

      const { data: rd } = await supabase.from("reactions").select(`stamp_id, user_id, stamp:stamps(id, name, url, thumbnail_url)`).eq("entry_id", entryId);
      if (rd) reactions = rd as unknown as ReactionData[];

      // Tapes — fetch placements then a side query for image_url so
      // group tapes' tile patterns can lazy-load on the client. See
      // groups/[id]/page.tsx for the same pattern.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: td } = await (supabase as any).from("entry_tapes").select("id, tape_id, x, y, length, rotation").eq("entry_id", entryId);
      const rawTapes = (td ?? []) as { id: string; tape_id: string; x: number; y: number; length: number; rotation: number }[];
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const groupTapeIds = Array.from(new Set(rawTapes.map((t) => t.tape_id))).filter((id) => uuidLike.test(id));
      const tapeUrlMap = new Map<string, string>();
      if (groupTapeIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tapeMeta } = await (supabase as any).from("tapes").select("id, image_url").in("id", groupTapeIds);
        for (const m of (tapeMeta ?? []) as { id: string; image_url: string }[]) {
          tapeUrlMap.set(m.id, m.image_url);
        }
      }
      entryTapes = rawTapes.map((t) => ({ ...t, image_url: tapeUrlMap.get(t.tape_id) ?? null }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bd } = await (supabase as any).from("entry_blocks").select("id, block_type, x, y, width, rotation, data").eq("entry_id", entryId);
      if (bd) entryBlocks = bd as EntryBlockData[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fd } = await (supabase as any).from("flipbooks").select(`fps, loop, frames:flipbook_frames(order, canvas_json)`).eq("entry_id", entryId).single();
      if (fd) flipbook = { fps: fd.fps, loop: fd.loop, frames: (fd.frames as { order: number; canvas_json: string }[]).map((fr) => ({ order: fr.order, canvasJson: fr.canvas_json })) };
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  const sortedMedia = entry.media?.sort((a, b) => a.order - b.order) ?? [];
  const date = new Date(entry.created_at);

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
          <Link href={`/groups/${groupId}`} className="btn btn-flat btn-sm">
            <ArrowLeft className="size-4" strokeWidth={1.6} />
            戻る
          </Link>
          <span className="meta">Entry</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 md:px-10 py-10 reveal reveal-1">
        <article className="card p-7 md:p-10">
          {/* Author + date */}
          <div className="flex items-center gap-3 mb-7">
            <div className="avatar avatar-lg">
              {entry.author?.name?.charAt(0) ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-medium t-hi">{entry.author?.name}</p>
              <p className="meta-sm mt-0.5">
                {date.toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </p>
            </div>
          </div>

          {/* Body */}
          {entry.body && (
            <div className="mb-7">
              <p className="text-[16px] leading-[1.85] whitespace-pre-wrap t-hi">
                {entry.body}
              </p>
            </div>
          )}

          {/* Media */}
          {sortedMedia.length > 0 && (
            <div className="mb-7">
              <div
                className={`grid gap-2.5 ${
                  sortedMedia.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-2"
                }`}
              >
                {sortedMedia.map((media) =>
                  media.type === "video" ? (
                    <div
                      key={media.id}
                      className="relative rounded-[10px] overflow-hidden border"
                      style={{ borderColor: "var(--stroke)", background: "var(--paper-alt)" }}
                    >
                      <video
                        src={media.url}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full max-h-80 rounded-[10px]"
                      />
                    </div>
                  ) : (
                    <div
                      key={media.id}
                      className="relative aspect-square overflow-hidden rounded-[10px] border"
                      style={{ borderColor: "var(--stroke)", background: "var(--paper-alt)" }}
                    >
                      <Image src={media.url} alt="" fill className="object-cover" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Stamps overlay (only shown when there is media to anchor to) */}
          {entryStamps.length > 0 && sortedMedia.length > 0 && (
            <EntryStampsDisplay
              stamps={entryStamps}
              canvasWidth={entry.canvas_width ?? 800}
              canvasHeight={entry.canvas_height ?? 600}
            />
          )}

          {/* Tape overlay — mirrors the stamps block above. The single-
              entry view is a list-style layout so tapes get their own
              sized container instead of being layered on the media. */}
          {entryTapes.length > 0 && (
            <EntryTapesDisplay
              tapes={entryTapes}
              canvasWidth={entry.canvas_width ?? 800}
              canvasHeight={entry.canvas_height ?? 600}
            />
          )}

          {/* Profile-book blocks — same pattern as tapes above. */}
          {entryBlocks.length > 0 && (
            <EntryBlocksDisplay
              blocks={entryBlocks}
              canvasWidth={entry.canvas_width ?? 800}
              canvasHeight={entry.canvas_height ?? 600}
            />
          )}

          {/* Flipbook */}
          {flipbook && flipbook.frames.length > 0 && (
            <div className="mb-7">
              <p className="meta-sm mb-2">パラパラアニメ</p>
              <FlipbookPlayer
                frames={flipbook.frames}
                fps={flipbook.fps}
                loop={flipbook.loop}
                width={Math.min(360, 800 * 0.5)}
              />
            </div>
          )}
        </article>

        {/* Reactions */}
        <div className="mt-4">
          <ReactionBar
            entryId={entryId}
            groupId={groupId}
            reactions={reactions}
            currentUserId={currentUserId}
          />
        </div>

        {/* Navigation */}
        <nav className="flex items-center justify-between pt-6 mt-8 border-t rule-hair">
          {prevEntry ? (
            <Link
              href={`/groups/${groupId}/entries/${prevEntry.id}`}
              className="btn btn-ghost btn-sm"
            >
              <ChevronLeft className="size-4" strokeWidth={1.6} />
              前の日記
            </Link>
          ) : (
            <span className="meta-sm">最初の日記</span>
          )}
          {nextEntry ? (
            <Link
              href={`/groups/${groupId}/entries/${nextEntry.id}`}
              className="btn btn-ghost btn-sm"
            >
              次の日記
              <ChevronRight className="size-4" strokeWidth={1.6} />
            </Link>
          ) : (
            <span className="meta-sm">最新の日記</span>
          )}
        </nav>
      </main>
    </div>
  );
}
