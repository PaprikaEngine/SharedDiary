import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { EntryStampsDisplay } from "./entry-stamps-display";
import { ReactionBar } from "./reaction-bar";

type Props = { params: Promise<{ id: string; entryId: string }> };
const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function EntryPage({ params }: Props) {
  const { id: groupId, entryId } = await params;

  type EntryWithRelations = {
    id: string; group_id: string; author_id: string; body: string | null; created_at: string;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
  };
  type EntryStampData = { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } };
  type ReactionData = { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } };

  let entry: EntryWithRelations = {
    id: entryId, group_id: groupId, author_id: "demo",
    body: "今日はいい天気だったね！公園でアイスを食べたよ\n\nまた明日も遊ぼうね。",
    created_at: new Date().toISOString(),
    author: { id: "demo", name: "ともだち", avatar_url: null }, media: null,
  };
  let prevEntry: { id: string } | null = null;
  let nextEntry: { id: string } | null = null;
  let entryStamps: EntryStampData[] = [];
  let reactions: ReactionData[] = [];
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
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  const sortedMedia = entry.media?.sort((a, b) => a.order - b.order) ?? [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="text-ink-light hover:text-ink transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="text-sm text-ink-light">タイムラインに戻る</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        {/* Entry as a "diary page" */}
        <article className="paper rounded-xl px-6 pt-8 pb-6 page-shadow relative">
          {/* Red margin line */}
          <div className="absolute left-12 top-0 bottom-0 w-px bg-coral/25" />

          {/* Author + date */}
          <div className="flex items-center gap-3 mb-5 pl-6">
            <span className="size-9 rounded-full bg-moss/15 text-moss text-sm font-bold flex items-center justify-center shrink-0">
              {entry.author?.name?.charAt(0) ?? "?"}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{entry.author?.name}</p>
              <p className="text-xs text-ink-light/50">
                {new Date(entry.created_at).toLocaleDateString("ja-JP", {
                  year: "numeric", month: "long", day: "numeric", weekday: "short",
                })}
              </p>
            </div>
          </div>

          {/* Body text */}
          {entry.body && (
            <div className="pl-6 mb-5">
              <p className="text-ink whitespace-pre-wrap leading-[32px] text-[15px]">
                {entry.body}
              </p>
            </div>
          )}

          {/* Media */}
          {sortedMedia.length > 0 && (
            <div className="pl-6 mb-5">
              <div className={`grid gap-2 ${sortedMedia.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {sortedMedia.map((media) => (
                  <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden bg-cream-dark/30">
                    <Image src={media.url} alt="" fill className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stamps */}
          {entryStamps.length > 0 && sortedMedia.length > 0 && (
            <div className="pl-6">
              <EntryStampsDisplay stamps={entryStamps} canvasWidth={800} canvasHeight={600} />
            </div>
          )}
        </article>

        {/* Reactions (outside the paper) */}
        <div className="mt-4 pl-2">
          <ReactionBar entryId={entryId} groupId={groupId} reactions={reactions} currentUserId={currentUserId} />
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-6 text-sm">
          {prevEntry ? (
            <Link href={`/groups/${groupId}/entries/${prevEntry.id}`} className="flex items-center gap-1 text-ink-light hover:text-moss transition-colors">
              <ChevronLeft className="size-4" /> 前の日記
            </Link>
          ) : <span className="text-ink-light/40">最初の日記</span>}
          {nextEntry ? (
            <Link href={`/groups/${groupId}/entries/${nextEntry.id}`} className="flex items-center gap-1 text-ink-light hover:text-moss transition-colors">
              次の日記 <ChevronRight className="size-4" />
            </Link>
          ) : <span className="text-ink-light/40">最新の日記</span>}
        </div>
      </main>
    </div>
  );
}
