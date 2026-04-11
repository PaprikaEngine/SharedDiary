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
    body: "今日はいい天気だったね！公園でアイスを食べたよ🍦\n\nまた明日も遊ぼうね。",
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-dark bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/groups/${groupId}`} className="text-ink-light hover:text-ink">
            ← タイムライン
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Entry Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-moss-light rounded-full flex items-center justify-center text-cream text-xl font-medium">
            {entry.author?.name?.charAt(0) ?? "?"}
          </div>
          <div>
            <p className="text-lg font-medium text-ink">{entry.author?.name}</p>
            <p className="text-sm text-ink-light">
              {new Date(entry.created_at).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
          </div>
        </div>

        {/* Entry Content */}
        <div className="bg-white border border-cream-dark rounded-xl p-6 mb-6">
          {entry.body ? (
            <p className="text-ink whitespace-pre-wrap leading-relaxed">
              {entry.body}
            </p>
          ) : (
            <p className="text-ink-light italic">テキストなし</p>
          )}
        </div>

        {/* Media Gallery */}
        {sortedMedia.length > 0 && (
          <div className="mb-8">
            <div
              className={`grid gap-3 ${
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
                  className="relative aspect-square rounded-xl overflow-hidden bg-cream-dark"
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
        <div className="flex items-center justify-between pt-6 border-t border-cream-dark">
          {prevEntry ? (
            <Link
              href={`/groups/${groupId}/entries/${prevEntry.id}`}
              className="text-moss hover:underline"
            >
              ← 前の日記
            </Link>
          ) : (
            <span className="text-ink-light">最初の日記</span>
          )}

          {nextEntry ? (
            <Link
              href={`/groups/${groupId}/entries/${nextEntry.id}`}
              className="text-moss hover:underline"
            >
              次の日記 →
            </Link>
          ) : (
            <span className="text-ink-light">最新の日記</span>
          )}
        </div>
      </main>
    </div>
  );
}
