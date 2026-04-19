import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string; entryId: string }>;
};

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function EntryPage({ params }: Props) {
  const { id: groupId, entryId } = await params;

  type EntryWithRelations = {
    id: string;
    group_id: string;
    author_id: string;
    body: string | null;
    created_at: string;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
  };

  let entry: EntryWithRelations = {
    id: entryId,
    group_id: groupId,
    author_id: "demo",
    body: "今日はいい天気だったね。公園でアイスを食べたよ。\n\nまた明日も遊ぼうね。",
    created_at: new Date().toISOString(),
    author: { id: "demo", name: "ともだち", avatar_url: null },
    media: null,
  };
  let prevEntry: { id: string } | null = null;
  let nextEntry: { id: string } | null = null;

  if (!isDemo) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        redirect("/login");
      }

      // Check membership
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        notFound();
      }

      // Get entry with author and media
      const { data: entryData } = await supabase
        .from("entries")
        .select(`
          *,
          author:users(id, name, avatar_url),
          media:entry_media(id, type, url, order, width, height)
        `)
        .eq("id", entryId)
        .eq("group_id", groupId)
        .single();

      if (!entryData) {
        notFound();
      }

      entry = entryData as EntryWithRelations;

      // Get adjacent entries for navigation
      const entryCreatedAt = entry.created_at;

      const { data: prevEntryData } = await supabase
        .from("entries")
        .select("id")
        .eq("group_id", groupId)
        .lt("created_at", entryCreatedAt)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: nextEntryData } = await supabase
        .from("entries")
        .select("id")
        .eq("group_id", groupId)
        .gt("created_at", entryCreatedAt)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      prevEntry = prevEntryData as { id: string } | null;
      nextEntry = nextEntryData as { id: string } | null;
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  const sortedMedia = entry.media?.sort((a, b) => a.order - b.order) ?? [];
  const date = new Date(entry.created_at);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b rule-hair" style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-3xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link href={`/groups/${groupId}`} className="btn btn-flat btn-sm">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M11 7H3M3 7L6.5 3.5M3 7L6.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            戻る
          </Link>
          <span className="meta">Entry</span>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-6 md:px-10 py-12 reveal reveal-1">
        {/* Meta row */}
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
        <div className="mb-8">
          {entry.body ? (
            <p className="text-[16px] leading-[1.85] whitespace-pre-wrap t-hi">
              {entry.body}
            </p>
          ) : (
            <p className="text-[13px] italic t-lo text-center py-6">本文はキャンバスにあります</p>
          )}
        </div>

        {/* Media */}
        {sortedMedia.length > 0 && (
          <div className="mb-10">
            <div
              className={`grid gap-2.5 ${
                sortedMedia.length === 1
                  ? "grid-cols-1"
                  : sortedMedia.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 md:grid-cols-3"
              }`}
            >
              {sortedMedia.map((media) => (
                <div
                  key={media.id}
                  className="relative aspect-square overflow-hidden rounded-[10px] border"
                  style={{ borderColor: "var(--stroke)", background: "var(--paper-alt)" }}
                >
                  <Image
                    src={media.url}
                    alt="Entry media"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex items-center justify-between pt-6 border-t rule-hair">
          {prevEntry ? (
            <Link href={`/groups/${groupId}/entries/${prevEntry.id}`} className="btn btn-ghost btn-sm">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M11 7H3M3 7L6.5 3.5M3 7L6.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              前の日記
            </Link>
          ) : (
            <span className="meta-sm">最初の日記</span>
          )}

          {nextEntry ? (
            <Link href={`/groups/${groupId}/entries/${nextEntry.id}`} className="btn btn-ghost btn-sm">
              次の日記
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <span className="meta-sm">最新の日記</span>
          )}
        </nav>
      </article>
    </div>
  );
}
