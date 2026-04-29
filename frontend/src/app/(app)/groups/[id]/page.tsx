import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Pencil } from "lucide-react";
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
    cover_image: string | null;
    current_baton_holder_id: string | null;
    current_holder: { id: string; name: string; avatar_url: string | null } | null;
    baton_deadline_days: number;
    baton_passed_at: string | null;
  };
  type Member = {
    role: "owner" | "member";
    member_order: number | null;
    user: { id: string; name: string; avatar_url: string | null } | null;
  };
  type EntryRow = {
    id: string;
    body: string | null;
    created_at: string;
    author_id: string;
    canvas_background: "ruled" | "plain" | "grid" | null;
    canvas_width: number | null;
    canvas_height: number | null;
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
  // Tapes are stored as DOM-overlay objects (post Phase 1 refactor).
  // tape_id is text — group tapes use a uuid that points at a row in
  // public.tapes; builtins use string slugs like "check-rose" with no
  // DB row, so image_url is hydrated only for the uuid case.
  type TapeRow = { id: string; tape_id: string; x: number; y: number; length: number; rotation: number; image_url: string | null };
  // Profile-book block — structured field card placed on the canvas.
  // `data` is a flat field-key → value map; field schema lives in the
  // client templates (block-templates.ts).
  type BlockRow = { id: string; block_type: string; x: number; y: number; width: number; rotation: number; data: Record<string, string> };

  let group: Group = {
    id,
    name: "高校の友達との日記",
    cover_image: null,
    current_baton_holder_id: "1",
    current_holder: { id: "1", name: "あなた", avatar_url: null },
    baton_deadline_days: 3,
    baton_passed_at: new Date().toISOString(),
  };
  let members: Member[] | null = [
    { role: "owner", member_order: 0, user: { id: "1", name: "あなた", avatar_url: null } },
    { role: "member", member_order: 1, user: { id: "2", name: "ともだち", avatar_url: null } },
  ];
  let isOwner = true;
  let hasBaton = true;
  let currentUserId: string | null = null;
  let currentUserDisplayName: string | null = null;

  type FlipbookRow = {
    fps: number; loop: boolean;
    x: number | null; y: number | null; scale: number | null;
    rotation: number | null; base_width: number | null; base_height: number | null;
    frames: { order: number; canvas_json: string }[];
  };

  type EntryData = {
    id: string; body: string | null; created_at: string;
    canvas_background: "ruled" | "plain" | "grid" | null;
    canvas_width: number | null;
    canvas_height: number | null;
    author: { id: string; name: string; avatar_url: string | null } | null;
    media: {
      id: string; type: string; url: string; order: number;
      width: number | null; height: number | null;
      x: number | null; y: number | null; scale: number | null;
      rotation: number | null; base_width: number | null;
    }[] | null;
    stamps: StampRow[]; reactions: ReactionRow[];
    tapes: TapeRow[];
    blocks: BlockRow[];
    flipbook: {
      fps: number; loop: boolean;
      x: number | null; y: number | null; scale: number | null;
      rotation: number | null; base_width: number | null; base_height: number | null;
      frames: { order: number; canvasJson: string }[];
    } | null;
  };

  let entries: EntryData[] = [
    {
      id: "demo-1",
      body: "今日はいい天気だったね！公園でアイスを食べたよ\n\nまた明日も遊ぼうね。",
      created_at: new Date().toISOString(),
      canvas_background: null,
      canvas_width: null, canvas_height: null,
      author: { id: "2", name: "ともだち", avatar_url: null },
      media: null, stamps: [], reactions: [], tapes: [], blocks: [], flipbook: null,
    },
    {
      id: "demo-2",
      body: "昨日は映画を見に行ったよ。すごくおもしろかった！また一緒に行こう",
      created_at: "2026-04-11T00:00:00.000Z",
      canvas_background: null,
      canvas_width: null, canvas_height: null,
      author: { id: "1", name: "あなた", avatar_url: null },
      media: null, stamps: [], reactions: [], tapes: [], blocks: [], flipbook: null,
    },
  ];

  if (!isDemo) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");
      currentUserId = user.id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membershipData } = await (supabase as any).from("group_members").select("role, display_name").eq("group_id", id).eq("user_id", user.id).single();
      if (!membershipData) notFound();
      currentUserDisplayName = (membershipData as { display_name: string | null }).display_name ?? null;

      // Lazy baton expiry: advance the baton if the deadline has passed.
      // Runs before fetching group state so we always see the latest holder.
      // Wrapped in its own try/catch — PostgrestBuilder doesn't implement
      // `.catch()`, so a chained `.catch()` throws synchronously and gets
      // swallowed by the outer catch below (falling back to demo data).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("check_and_advance_expired_baton", { p_group_id: id });
      } catch {/* best-effort */}

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: groupData } = await (supabase as any).from("groups").select(`*, current_holder:users!groups_current_baton_holder_id_fkey(id, name, avatar_url)`).eq("id", id).single();
      if (!groupData) notFound();
      group = groupData as Group;

      // Fetch members ordered by member_order so nextInOrder is derivable.
      // group_members has no id column (composite PK group_id + user_id),
      // so profile-book links keyed by user.id are sufficient.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membersData } = await (supabase as any).from("group_members").select(`role, member_order, user:users(id, name, avatar_url)`).eq("group_id", id).order("member_order", { ascending: true });
      members = membersData as Member[] | null;

      // Fetch entries (newest first). Avoid PostgREST embedded selects —
      // the `order` column on entry_media / flipbook_frames collides with
      // PostgREST's `order` directive and can silently return no rows.
      // Filter to kind='diary' so profile-book entries (which live in
      // the same table but get their own /profiles/[memberId] view)
      // don't leak into the diary timeline.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entriesData, error: entriesError } = await (supabase as any)
        .from("entries")
        .select("id, body, created_at, author_id, canvas_background, canvas_width, canvas_height")
        .eq("group_id", id)
        .eq("kind", "diary")
        .order("created_at", { ascending: false });
      if (entriesError) console.error("[GroupPage] entries fetch failed:", entriesError);
      const rawEntries = (entriesData ?? []) as EntryRow[];

      const authorIds = Array.from(new Set(rawEntries.map((e) => e.author_id)));
      const authorsMap = new Map<string, UserRow>();
      if (authorIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: authorsData } = await (supabase as any).from("users").select("id, name, avatar_url").in("id", authorIds);
        for (const u of (authorsData ?? []) as UserRow[]) authorsMap.set(u.id, u);
      }

      const entryIds = rawEntries.map((e) => e.id);
      let allMedia: MediaRow[] = [];
      let allStamps: (StampRow & { entry_id: string })[] = [];
      let allReactions: (ReactionRow & { entry_id: string })[] = [];
      let allFlipbooks: (FlipbookRow & { entry_id: string })[] = [];
      let allTapes: (TapeRow & { entry_id: string })[] = [];
      let allBlocks: (BlockRow & { entry_id: string })[] = [];

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
        const { data: fd } = await (supabase as any).from("flipbooks").select(`entry_id, fps, loop, x, y, scale, rotation, base_width, base_height, frames:flipbook_frames(order, canvas_json)`).in("entry_id", entryIds);
        if (fd) allFlipbooks = fd as (FlipbookRow & { entry_id: string })[];

        // Tapes — entry_tapes plus a side-fetch on the tapes table for
        // group-uploaded ones so the viewer can lazy-load tile images
        // without re-querying per entry.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tdRows } = await (supabase as any).from("entry_tapes").select("id, entry_id, tape_id, x, y, length, rotation").in("entry_id", entryIds);
        const rawTapes = (tdRows ?? []) as { id: string; entry_id: string; tape_id: string; x: number; y: number; length: number; rotation: number }[];

        const tapeUrlMap = new Map<string, string>();
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const groupTapeIds = Array.from(new Set(rawTapes.map((t) => t.tape_id))).filter((id) => uuidLike.test(id));
        if (groupTapeIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: tapeMeta } = await (supabase as any).from("tapes").select("id, image_url").in("id", groupTapeIds);
          for (const m of (tapeMeta ?? []) as { id: string; image_url: string }[]) {
            tapeUrlMap.set(m.id, m.image_url);
          }
        }
        allTapes = rawTapes.map((t) => ({
          ...t,
          image_url: tapeUrlMap.get(t.tape_id) ?? null,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bd } = await (supabase as any).from("entry_blocks").select("id, entry_id, block_type, x, y, width, rotation, data").in("entry_id", entryIds);
        if (bd) allBlocks = bd as (BlockRow & { entry_id: string })[];
      }

      entries = rawEntries.map((e) => {
        const fb = allFlipbooks.find((f) => f.entry_id === e.id);
        return {
          id: e.id,
          body: e.body,
          created_at: e.created_at,
          canvas_background: e.canvas_background,
          canvas_width: e.canvas_width,
          canvas_height: e.canvas_height,
          author: authorsMap.get(e.author_id) ?? null,
          media: allMedia.filter((m) => m.entry_id === e.id),
          stamps: allStamps.filter((s) => s.entry_id === e.id),
          reactions: allReactions.filter((r) => r.entry_id === e.id),
          tapes: allTapes.filter((t) => t.entry_id === e.id),
          blocks: allBlocks.filter((b) => b.entry_id === e.id),
          flipbook: fb ? {
            fps: fb.fps, loop: fb.loop,
            x: fb.x, y: fb.y, scale: fb.scale, rotation: fb.rotation,
            base_width: fb.base_width, base_height: fb.base_height,
            frames: fb.frames.map((fr) => ({ order: fr.order, canvasJson: fr.canvas_json })),
          } : null,
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
  let hoursLeft: number | null = null;
  let daysLeft: number | null = null;
  let isOverdue = false;
  if (passedAt && deadlineDays > 0) {
    const deadline = new Date(passedAt.getTime() + deadlineDays * 86400000);
    const now = new Date();
    const msLeft = deadline.getTime() - now.getTime();
    hoursLeft = msLeft / 3600000;
    daysLeft = Math.ceil(hoursLeft / 24);
    isOverdue = hoursLeft < 0;
  }
  const within24h = hoursLeft !== null && hoursLeft >= 0 && hoursLeft < 24;
  const deadlineColor = isOverdue || within24h ? "var(--danger)" : undefined;
  const deadlineText =
    isOverdue ? "期限超過"
    : hoursLeft === null ? null
    : within24h ? `あと${Math.ceil(hoursLeft)}時間`
    : `あと${daysLeft}日`;

  // Who comes after the current baton holder in member_order sequence?
  const orderedMembers = (members ?? [])
    .filter((m) => m.user !== null && m.member_order !== null)
    .sort((a, b) => (a.member_order ?? 0) - (b.member_order ?? 0));
  const currentHolderIndex = orderedMembers.findIndex(
    (m) => m.user?.id === group.current_baton_holder_id
  );
  const nextInOrder =
    orderedMembers.length > 1 && currentHolderIndex !== -1
      ? orderedMembers[(currentHolderIndex + 1) % orderedMembers.length]?.user
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-10 border-b rule-hair"
        style={{
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/groups" className="btn btn-flat btn-sm shrink-0">
              <ArrowLeft className="size-4" strokeWidth={1.6} />
              <span className="hidden sm:inline">Library</span>
            </Link>
            <span className="t-xlo hidden sm:inline">/</span>
            <span className="text-[13.5px] font-medium t-hi truncate max-w-[200px] md:max-w-[360px]">
              {group.name}
            </span>
            {/* Members inline (desktop only). Each avatar is a link
                to that member's プロフィール帳 page; "+N" leads to the
                profile index (which redirects to the first member). */}
            <div className="hidden md:flex items-center gap-1 ml-2 shrink-0">
              {(members ?? [])
                .filter((m): m is Member & { user: NonNullable<Member["user"]> } => m.user !== null)
                .slice(0, 5)
                .map((m) => (
                  <Link
                    key={m.user.id}
                    href={`/groups/${id}/profiles/${m.user.id}`}
                    className="avatar hover:ring-2 hover:ring-moss/30 transition-shadow"
                    title={`${m.user.name} のプロフィール`}
                  >
                    {m.user.name.charAt(0)}
                  </Link>
                ))}
              {(members?.length ?? 0) > 5 && (
                <Link
                  href={`/groups/${id}/profiles`}
                  className="meta-sm ml-1 hover:t-hi transition-colors"
                  title="全員のプロフィール"
                >
                  +{(members?.length ?? 0) - 5}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Baton status inline */}
            {group.current_holder && (
              hasBaton ? (
                <span className="meta hidden sm:inline flex items-center gap-1.5">
                  {deadlineText && (
                    <span style={{ color: deadlineColor }}>{deadlineText}</span>
                  )}
                  {nextInOrder && (
                    <span className="text-ink-light/50">→ 次: {nextInOrder.name}</span>
                  )}
                </span>
              ) : (
                <span className="meta hidden sm:inline flex items-center gap-1.5">
                  <span>{group.current_holder.name} の番</span>
                  {deadlineText && (
                    <span style={{ color: deadlineColor }}>({deadlineText})</span>
                  )}
                  {nextInOrder && (
                    <span className="text-ink-light/50">→ 次: {nextInOrder.name}</span>
                  )}
                </span>
              )
            )}

            {hasBaton && (
              <Link href={`/groups/${id}/new`} className="btn btn-primary btn-sm">
                <Pencil className="size-3.5" strokeWidth={1.8} />
                書く
              </Link>
            )}
            {isOwner && <InviteButton groupId={id} />}
            <ExportPdfButton groupId={id} groupName={group.name} />
            {currentUserId && (
              <GroupMenu
                groupId={id}
                currentUserId={currentUserId}
                isOwner={isOwner}
                hasBaton={hasBaton}
                currentUserDisplayName={currentUserDisplayName}
                members={
                  (members ?? [])
                    .filter((m): m is Member & { user: NonNullable<Member["user"]> } => m.user !== null)
                    .map((m) => ({ id: m.user.id, name: m.user.name, memberOrder: m.member_order ?? undefined }))
                }
              />
            )}
          </div>
        </div>
      </header>

      {/* Diary pages — fill remaining space */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 py-4">
        {/* Cover image — desktop only.
            On mobile the cover is rendered inside PageViewer as the
            first page (see `coverImage` + `coverIsFirstPage` props). */}
        {group.cover_image && (
          <div className="relative w-full h-56 rounded-xl overflow-hidden mb-5 hidden md:block">
            <Image
              src={group.cover_image}
              alt={`${group.name}の表紙`}
              fill
              className="object-cover"
              sizes="1024px"
              priority
            />
          </div>
        )}

        <PageViewer
          entries={entries}
          initialIndex={0}
          groupId={id}
          groupName={group.name}
          coverImage={group.cover_image}
          currentUserId={currentUserId}
          hasBaton={hasBaton}
          isOwner={isOwner}
          totalCount={entries.length}
          batonStatus={
            group.current_holder
              ? {
                  holderName: group.current_holder.name,
                  holderAvatar: group.current_holder.avatar_url,
                  deadlineText,
                  deadlineColor,
                  nextInOrderName: nextInOrder?.name ?? null,
                }
              : null
          }
        />
      </main>
    </div>
  );
}
