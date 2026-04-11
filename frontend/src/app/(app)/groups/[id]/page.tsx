import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { InviteButton } from "./invite-button";
import { PageViewer } from "./page-viewer";

type Props = {
  params: Promise<{ id: string }>;
};

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function GroupPage({ params }: Props) {
  const { id } = await params;

  type Group = {
    id: string;
    name: string;
    current_baton_holder_id: string | null;
    current_holder: { id: string; name: string; avatar_url: string | null } | null;
  };
  type Member = {
    role: "owner" | "member";
    user: { id: string; name: string; avatar_url: string | null } | null;
  };
  type EntryRow = {
    id: string;
    body: string | null;
    created_at: string;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
  };
  type StampRow = { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } };
  type ReactionRow = { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } };

  let group: Group = { id, name: "高校の友達との日記", current_baton_holder_id: "1", current_holder: { id: "1", name: "あなた", avatar_url: null } };
  let members: Member[] | null = [
    { role: "owner", user: { id: "1", name: "あなた", avatar_url: null } },
    { role: "member", user: { id: "2", name: "ともだち", avatar_url: null } },
  ];
  let isOwner = true;
  let hasBaton = true;
  let currentUserId: string | null = null;

  // Entries with full data for page viewer
  type EntryData = {
    id: string; body: string | null; created_at: string;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: { id: string; type: string; url: string; order: number; width: number | null; height: number | null }[] | null;
    stamps: StampRow[]; reactions: ReactionRow[];
  };

  let entries: EntryData[] = [
    {
      id: "demo-1", body: "今日はいい天気だったね！公園でアイスを食べたよ\n\nまた明日も遊ぼうね。",
      created_at: new Date().toISOString(),
      author: { id: "2", name: "ともだち", avatar_url: null }, media: null, stamps: [], reactions: [],
    },
    {
      id: "demo-2", body: "昨日は映画を見に行ったよ。すごくおもしろかった！また一緒に行こう",
      created_at: "2026-04-11T00:00:00.000Z",
      author: { id: "1", name: "あなた", avatar_url: null }, media: null, stamps: [], reactions: [],
    },
  ];

  if (!isDemo) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");
      currentUserId = user.id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membershipData } = await (supabase as any).from("group_members").select("role").eq("group_id", id).eq("user_id", user.id).single();
      if (!membershipData) notFound();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: groupData } = await (supabase as any).from("groups").select(`*, current_holder:users!groups_current_baton_holder_id_fkey(id, name, avatar_url)`).eq("id", id).single();
      if (!groupData) notFound();
      group = groupData as Group;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membersData } = await (supabase as any).from("group_members").select(`role, user:users(id, name, avatar_url)`).eq("group_id", id);
      members = membersData as Member[] | null;

      // Fetch all entries (newest first) with media
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entriesData } = await (supabase as any).from("entries").select(`id, body, created_at, author:users(id, name, avatar_url), media:entry_media(id, type, url, order, width, height)`).eq("group_id", id).order("created_at", { ascending: false });
      const rawEntries = (entriesData ?? []) as EntryRow[];

      // Fetch stamps and reactions for all entries
      const entryIds = rawEntries.map((e) => e.id);
      let allStamps: (StampRow & { entry_id: string })[] = [];
      let allReactions: (ReactionRow & { entry_id: string })[] = [];

      if (entryIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sd } = await (supabase as any).from("entry_stamps").select(`id, entry_id, x, y, scale, rotation, stamp:stamps(url, thumbnail_url)`).in("entry_id", entryIds);
        if (sd) allStamps = sd as (StampRow & { entry_id: string })[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rd } = await (supabase as any).from("reactions").select(`entry_id, stamp_id, user_id, stamp:stamps(id, name, url, thumbnail_url)`).in("entry_id", entryIds);
        if (rd) allReactions = rd as (ReactionRow & { entry_id: string })[];
      }

      entries = rawEntries.map((e) => ({
        ...e,
        stamps: allStamps.filter((s) => s.entry_id === e.id),
        reactions: allReactions.filter((r) => r.entry_id === e.id),
      }));

      isOwner = (membershipData as { role: string }).role === "owner";
      hasBaton = group.current_baton_holder_id === user.id;
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header: group name + baton + members */}
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/groups" className="text-ink-light hover:text-ink transition-colors shrink-0">
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="text-base font-semibold text-ink truncate">{group.name}</h1>
            {/* Members inline */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {members?.slice(0, 5).map((m) => (
                <span key={m.user?.id} className="size-6 rounded-full bg-moss/15 text-moss text-[9px] font-bold flex items-center justify-center" title={m.user?.name ?? ""}>
                  {m.user?.name?.charAt(0)}
                </span>
              ))}
              {(members?.length ?? 0) > 5 && (
                <span className="text-[10px] text-ink-light/50">+{(members?.length ?? 0) - 5}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Baton inline */}
            {group.current_holder && (
              hasBaton ? (
                <Link href={`/groups/${id}/new`} className="text-xs font-medium text-white bg-moss hover:bg-moss-dark rounded-full px-3 py-1.5 transition-colors">
                  ✏️ 書く
                </Link>
              ) : (
                <span className="text-xs text-ink-light">🎀 {group.current_holder.name}さんの番</span>
              )
            )}
            {isOwner && <InviteButton groupId={id} />}
          </div>
        </div>
      </header>

      {/* Diary pages — fill remaining space */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 py-4">
        <PageViewer
          entries={entries}
          initialIndex={0}
          groupId={id}
          currentUserId={currentUserId}
          hasBaton={hasBaton}
          totalCount={entries.length}
        />
      </main>
    </div>
  );
}
