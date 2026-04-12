import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { InviteButton } from "./invite-button";
import { PageViewer } from "./page-viewer";
import { GroupMenu } from "./group-menu";
import { ExportPdfButton } from "@/components/export-pdf";

type Props = {
  params: Promise<{ id: string }>;
};

// This page must be re-rendered on every request so newly posted entries
// appear immediately after `router.refresh()` from /groups/[id]/new.
export const dynamic = "force-dynamic";

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function GroupPage({ params }: Props) {
  const { id } = await params;

  type Group = {
    id: string;
    name: string;
    current_baton_holder_id: string | null;
    current_holder: { id: string; name: string; avatar_url: string | null } | null;
    baton_deadline_days: number;
    baton_passed_at: string | null;
  };
  type Member = {
    role: "owner" | "member";
    user: { id: string; name: string; avatar_url: string | null } | null;
  };
  type EntryRow = {
    id: string;
    body: string | null;
    created_at: string;
    author_id: string;
    canvas_background: "ruled" | "plain" | "grid" | null;
  };
  type MediaRow = {
    id: string; entry_id: string; type: string; url: string; order: number;
    width: number | null; height: number | null;
    x: number | null; y: number | null; scale: number | null;
    rotation: number | null; base_width: number | null;
  };
  type UserRow = { id: string; name: string; avatar_url: string | null };
  type StampRow = { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } };
  type ReactionRow = { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } };

  let group: Group = { id, name: "高校の友達との日記", current_baton_holder_id: "1", current_holder: { id: "1", name: "あなた", avatar_url: null }, baton_deadline_days: 3, baton_passed_at: new Date().toISOString() };
  let members: Member[] | null = [
    { role: "owner", user: { id: "1", name: "あなた", avatar_url: null } },
    { role: "member", user: { id: "2", name: "ともだち", avatar_url: null } },
  ];
  let isOwner = true;
  let hasBaton = true;
  let currentUserId: string | null = null;

  type FlipbookRow = { fps: number; loop: boolean; frames: { order: number; canvas_json: string }[] };

  // Entries with full data for page viewer
  type EntryData = {
    id: string; body: string | null; created_at: string;
    canvas_background: "ruled" | "plain" | "grid" | null;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: {
      id: string; type: string; url: string; order: number;
      width: number | null; height: number | null;
      x: number | null; y: number | null; scale: number | null;
      rotation: number | null; base_width: number | null;
    }[] | null;
    stamps: StampRow[]; reactions: ReactionRow[];
    flipbook: { fps: number; loop: boolean; frames: { order: number; canvasJson: string }[] } | null;
  };

  let entries: EntryData[] = [
    {
      id: "demo-1", body: "今日はいい天気だったね！公園でアイスを食べたよ\n\nまた明日も遊ぼうね。",
      created_at: new Date().toISOString(), canvas_background: null,
      author: { id: "2", name: "ともだち", avatar_url: null }, media: null, stamps: [], reactions: [], flipbook: null,
    },
    {
      id: "demo-2", body: "昨日は映画を見に行ったよ。すごくおもしろかった！また一緒に行こう",
      created_at: "2026-04-11T00:00:00.000Z", canvas_background: null,
      author: { id: "1", name: "あなた", avatar_url: null }, media: null, stamps: [], reactions: [], flipbook: null,
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

      // Fetch entries (newest first). Avoid PostgREST embedded selects —
      // the `order` column on entry_media / flipbook_frames collides with
      // PostgREST's `order` directive and can silently return no rows.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entriesData, error: entriesError } = await (supabase as any)
        .from("entries")
        .select("id, body, created_at, author_id, canvas_background")
        .eq("group_id", id)
        .order("created_at", { ascending: false });
      if (entriesError) console.error("[GroupPage] entries fetch failed:", entriesError);
      const rawEntries = (entriesData ?? []) as EntryRow[];

      // Fetch authors in a separate query
      const authorIds = Array.from(new Set(rawEntries.map((e) => e.author_id)));
      const authorsMap = new Map<string, UserRow>();
      if (authorIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: authorsData } = await (supabase as any).from("users").select("id, name, avatar_url").in("id", authorIds);
        for (const u of (authorsData ?? []) as UserRow[]) authorsMap.set(u.id, u);
      }

      // Fetch media, stamps, reactions, flipbooks for all entries
      const entryIds = rawEntries.map((e) => e.id);
      let allMedia: MediaRow[] = [];
      let allStamps: (StampRow & { entry_id: string })[] = [];
      let allReactions: (ReactionRow & { entry_id: string })[] = [];
      let allFlipbooks: (FlipbookRow & { entry_id: string })[] = [];

      if (entryIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: md } = await (supabase as any).from("entry_media").select("id, entry_id, type, url, order, width, height, x, y, scale, rotation, base_width").in("entry_id", entryIds);
        if (md) allMedia = md as MediaRow[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sd } = await (supabase as any).from("entry_stamps").select(`id, entry_id, x, y, scale, rotation, stamp:stamps(url, thumbnail_url)`).in("entry_id", entryIds);
        if (sd) allStamps = sd as (StampRow & { entry_id: string })[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rd } = await (supabase as any).from("reactions").select(`entry_id, stamp_id, user_id, stamp:stamps(id, name, url, thumbnail_url)`).in("entry_id", entryIds);
        if (rd) allReactions = rd as (ReactionRow & { entry_id: string })[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fd } = await (supabase as any).from("flipbooks").select(`entry_id, fps, loop, frames:flipbook_frames(order, canvas_json)`).in("entry_id", entryIds);
        if (fd) allFlipbooks = fd as (FlipbookRow & { entry_id: string })[];
      }

      entries = rawEntries.map((e) => {
        const fb = allFlipbooks.find((f) => f.entry_id === e.id);
        return {
          id: e.id,
          body: e.body,
          created_at: e.created_at,
          canvas_background: e.canvas_background,
          author: authorsMap.get(e.author_id) ?? null,
          media: allMedia.filter((m) => m.entry_id === e.id),
          stamps: allStamps.filter((s) => s.entry_id === e.id),
          reactions: allReactions.filter((r) => r.entry_id === e.id),
          flipbook: fb ? { fps: fb.fps, loop: fb.loop, frames: fb.frames.map((fr) => ({ order: fr.order, canvasJson: fr.canvas_json })) } : null,
        };
      });

      isOwner = (membershipData as { role: string }).role === "owner";
      hasBaton = group.current_baton_holder_id === user.id;
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  // Baton deadline calculation
  const deadlineDays = group.baton_deadline_days;
  const passedAt = group.baton_passed_at ? new Date(group.baton_passed_at) : null;
  let daysLeft: number | null = null;
  let isOverdue = false;
  if (passedAt && deadlineDays > 0) {
    const deadline = new Date(passedAt.getTime() + deadlineDays * 86400000);
    const now = new Date();
    daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
    isOverdue = daysLeft < 0;
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
            {/* Baton inline with deadline */}
            {group.current_holder && (
              hasBaton ? (
                <div className="flex items-center gap-2">
                  {daysLeft !== null && (
                    <span className={`text-[10px] ${isOverdue ? "text-red-500" : daysLeft <= 1 ? "text-orange-500" : "text-ink-light/50"}`}>
                      {isOverdue ? "期限超過" : daysLeft === 0 ? "今日まで" : `あと${daysLeft}日`}
                    </span>
                  )}
                  <Link href={`/groups/${id}/new`} className="text-xs font-medium text-white bg-moss hover:bg-moss-dark rounded-full px-3 py-1.5 transition-colors">
                    ✏️ 書く
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-ink-light">🎀 {group.current_holder.name}さんの番</span>
                  {daysLeft !== null && (
                    <span className={`text-[10px] ${isOverdue ? "text-red-500" : daysLeft <= 1 ? "text-orange-500" : "text-ink-light/40"}`}>
                      {isOverdue ? "(期限超過)" : daysLeft === 0 ? "(今日まで)" : `(あと${daysLeft}日)`}
                    </span>
                  )}
                </div>
              )
            )}
            {isOwner && <InviteButton groupId={id} />}
            <ExportPdfButton groupId={id} groupName={group.name} />
            {currentUserId && (
              <GroupMenu
                groupId={id}
                currentUserId={currentUserId}
                isOwner={isOwner}
                hasBaton={hasBaton}
                currentHolderId={group.current_baton_holder_id}
                members={
                  (members ?? [])
                    .map((m) => m.user)
                    .filter((u): u is { id: string; name: string; avatar_url: string | null } => u !== null)
                    .map((u) => ({ id: u.id, name: u.name }))
                }
              />
            )}
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
          isOwner={isOwner}
          totalCount={entries.length}
        />
      </main>
    </div>
  );
}
