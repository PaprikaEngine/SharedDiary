import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProfileCanvasFrame } from "./profile-canvas-frame";

type Props = { params: Promise<{ id: string; userId: string }> };

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

const LEGACY_CANVAS_WIDTH = 800;
const LEGACY_CANVAS_HEIGHT = 600;

export default async function ProfilePage({ params }: Props) {
  const { id: groupId, userId } = await params;

  if (isDemo) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-light">
        プロフィール帳はデモでは利用できません
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Membership check — non-members can't see profiles in this group.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!membership) notFound();

  // Member identity + ownership.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRow } = await (supabase as any)
    .from("group_members")
    .select("user:users(id, name, avatar_url)")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .single();
  if (!memberRow) notFound();
  const member = memberRow as {
    user: { id: string; name: string; avatar_url: string | null } | null;
  };
  const isOwner = userId === user.id;

  // Member nav — baton order, used for prev/next links.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderedRaw } = await (supabase as any)
    .from("group_members")
    .select("user:users(id, name)")
    .eq("group_id", groupId)
    .order("member_order", { ascending: true });
  const ordered = (orderedRaw ?? []) as { user: { id: string; name: string } | null }[];
  const idx = ordered.findIndex((m) => m.user?.id === userId);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  // Profile entry — may not exist (member hasn't written one yet).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entryRow } = await (supabase as any)
    .from("entries")
    .select("id, canvas_background, canvas_width, canvas_height, created_at")
    .eq("group_id", groupId)
    .eq("kind", "profile")
    .eq("profile_owner_user_id", userId)
    .maybeSingle();
  const entry = entryRow as
    | { id: string; canvas_background: "ruled" | "plain" | "grid" | null; canvas_width: number | null; canvas_height: number | null; created_at: string }
    | null;

  type MediaRow = { id: string; type: string; url: string; order: number; width: number | null; height: number | null; x: number | null; y: number | null; scale: number | null; rotation: number | null; base_width: number | null };
  type StampRow = { id: string; x: number; y: number; scale: number; rotation: number; stamp: { url: string; thumbnail_url: string | null } };
  type TapeRow = { id: string; tape_id: string; x: number; y: number; length: number; rotation: number; image_url: string | null };
  type BlockRow = { id: string; block_type: string; x: number; y: number; width: number; rotation: number; data: Record<string, string> };
  type FlipbookRow = { fps: number; loop: boolean; x: number | null; y: number | null; scale: number | null; rotation: number | null; base_width: number | null; base_height: number | null; frames: { order: number; canvas_json: string }[] };

  let allMedia: MediaRow[] = [];
  let stamps: StampRow[] = [];
  let tapes: TapeRow[] = [];
  let blocks: BlockRow[] = [];
  let flipbook: { fps: number; loop: boolean; x: number | null; y: number | null; scale: number | null; rotation: number | null; base_width: number | null; base_height: number | null; frames: { order: number; canvasJson: string }[] } | null = null;

  if (entry) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: md } = await (supabase as any)
      .from("entry_media")
      .select("id, type, url, order, width, height, x, y, scale, rotation, base_width")
      .eq("entry_id", entry.id);
    if (md) allMedia = md as MediaRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sd } = await (supabase as any)
      .from("entry_stamps")
      .select("id, x, y, scale, rotation, stamp:stamps(url, thumbnail_url)")
      .eq("entry_id", entry.id);
    if (sd) stamps = sd as StampRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdRows } = await (supabase as any)
      .from("entry_tapes")
      .select("id, tape_id, x, y, length, rotation")
      .eq("entry_id", entry.id);
    const rawTapes = (tdRows ?? []) as { id: string; tape_id: string; x: number; y: number; length: number; rotation: number }[];
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
    tapes = rawTapes.map((t) => ({ ...t, image_url: tapeUrlMap.get(t.tape_id) ?? null }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bd } = await (supabase as any)
      .from("entry_blocks")
      .select("id, block_type, x, y, width, rotation, data")
      .eq("entry_id", entry.id);
    if (bd) blocks = bd as BlockRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fd } = await (supabase as any)
      .from("flipbooks")
      .select("fps, loop, x, y, scale, rotation, base_width, base_height, frames:flipbook_frames(order, canvas_json)")
      .eq("entry_id", entry.id)
      .maybeSingle();
    if (fd) {
      const fbRow = fd as FlipbookRow;
      flipbook = {
        fps: fbRow.fps, loop: fbRow.loop,
        x: fbRow.x, y: fbRow.y, scale: fbRow.scale, rotation: fbRow.rotation,
        base_width: fbRow.base_width, base_height: fbRow.base_height,
        frames: fbRow.frames.map((fr) => ({ order: fr.order, canvasJson: fr.canvas_json })),
      };
    }
  }

  // Split out the canvas.png (saved as entry_media order=0) from
  // user-attached photos/videos so the handwritten layer renders as
  // the canvas background image rather than a thumbnail tile.
  const sortedMedia = allMedia.sort((a, b) => a.order - b.order);
  const canvasMedia = sortedMedia.find(
    (m) => m.type === "image" && (m.url.endsWith("/canvas.png") || m.url.includes("/canvas.png?"))
  ) ?? null;
  const otherMedia = sortedMedia.filter((m) => m !== canvasMedia);
  const placedMedia = otherMedia
    .filter((m) => m.x != null && m.y != null && m.base_width != null)
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      x: m.x as number,
      y: m.y as number,
      scale: m.scale ?? 1,
      rotation: m.rotation ?? 0,
      base_width: m.base_width as number,
      width: m.width,
      height: m.height,
    }));

  const canvasW = entry?.canvas_width ?? LEGACY_CANVAS_WIDTH;
  const canvasH = entry?.canvas_height ?? LEGACY_CANVAS_HEIGHT;
  const memberName = member.user?.name ?? "メンバー";

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b rule-hair"
        style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between gap-3">
          <Link href={`/groups/${groupId}`} className="btn btn-flat btn-sm shrink-0">
            <ArrowLeft className="size-4" strokeWidth={1.6} />
            戻る
          </Link>
          <span className="meta truncate">プロフィール帳 · {memberName}</span>
          {isOwner ? (
            <Link
              href={`/groups/${groupId}/profiles/${userId}/edit`}
              className="btn btn-primary btn-sm shrink-0"
            >
              <Pencil className="size-3.5" strokeWidth={1.8} />
              編集
            </Link>
          ) : (
            <span className="size-8" aria-hidden />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {entry ? (
          <ProfileCanvasFrame
            canvasBackground={entry.canvas_background}
            canvasWidth={canvasW}
            canvasHeight={canvasH}
            canvasImageUrl={canvasMedia?.url ?? null}
            placedMedia={placedMedia}
            stamps={stamps}
            tapes={tapes}
            blocks={blocks}
            flipbook={flipbook}
          />
        ) : (
          // No profile yet — show a polite blank state, plus a CTA for
          // the owner so they can start their own page.
          <div
            className="w-full max-w-[800px] mx-auto rounded-lg border border-dashed border-cream-dark/60 flex flex-col items-center justify-center text-center p-10"
            style={{ aspectRatio: `${LEGACY_CANVAS_WIDTH} / ${LEGACY_CANVAS_HEIGHT}` }}
          >
            <p className="text-sm text-ink-light mb-2">まだ書かれていません</p>
            {isOwner && (
              <Link
                href={`/groups/${groupId}/profiles/${userId}/edit`}
                className="btn btn-primary btn-sm mt-3"
              >
                <Pencil className="size-3.5" strokeWidth={1.8} />
                プロフィールを書く
              </Link>
            )}
          </div>
        )}

        {/* Member nav — moves between members in baton order. */}
        <nav className="flex items-center justify-between pt-6 mt-8 border-t rule-hair">
          {prev?.user ? (
            <Link href={`/groups/${groupId}/profiles/${prev.user.id}`} className="btn btn-ghost btn-sm">
              <ChevronLeft className="size-4" strokeWidth={1.6} />
              {prev.user.name}
            </Link>
          ) : (
            <span className="meta-sm">最初のメンバー</span>
          )}
          {next?.user ? (
            <Link href={`/groups/${groupId}/profiles/${next.user.id}`} className="btn btn-ghost btn-sm">
              {next.user.name}
              <ChevronRight className="size-4" strokeWidth={1.6} />
            </Link>
          ) : (
            <span className="meta-sm">最後のメンバー</span>
          )}
        </nav>
      </main>
    </div>
  );
}
