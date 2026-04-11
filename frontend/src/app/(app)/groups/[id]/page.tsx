import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteButton } from "./invite-button";
import { BatonStatus } from "./baton-status";

type Props = {
  params: Promise<{ id: string }>;
};

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function GroupPage({ params }: Props) {
  const { id } = await params;

  // Type definitions for query results
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
  type Entry = {
    id: string;
    body: string | null;
    created_at: string;
    author: { name: string; avatar_url: string | null } | null;
  };

  let group: Group = { id, name: "高校の友達との日記", current_baton_holder_id: "1", current_holder: { id: "1", name: "あなた", avatar_url: null } };
  let members: Member[] | null = [
    { role: "owner", user: { id: "1", name: "あなた", avatar_url: null } },
    { role: "member", user: { id: "2", name: "ともだち", avatar_url: null } },
  ];
  let entries: Entry[] | null = [
    { id: "demo-1", body: "今日はいい天気だったね！公園でアイスを食べたよ🍦", created_at: new Date().toISOString(), author: { name: "ともだち", avatar_url: null } },
    { id: "demo-2", body: "昨日は映画を見に行ったよ。すごくおもしろかった！また一緒に行こう😊", created_at: new Date(Date.now() - 86400000).toISOString(), author: { name: "あなた", avatar_url: null } },
  ];
  let isOwner = true;
  let hasBaton = true;

  if (!isDemo) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // Check membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membershipData } = await (supabase as any)
      .from("group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .single();

    if (!membershipData) {
      notFound();
    }

    // Get group details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupData } = await (supabase as any)
      .from("groups")
      .select(`
        *,
        current_holder:users!groups_current_baton_holder_id_fkey(id, name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (!groupData) {
      notFound();
    }
    group = groupData as Group;

    // Get members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membersData } = await (supabase as any)
      .from("group_members")
      .select(`
        role,
        user:users(id, name, avatar_url)
      `)
      .eq("group_id", id);
    members = membersData as Member[] | null;

    // Get recent entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entriesData } = await (supabase as any)
      .from("entries")
      .select(`
        id,
        body,
        created_at,
        author:users(name, avatar_url)
      `)
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(10);
    entries = entriesData as Entry[] | null;

    isOwner = (membershipData as { role: string }).role === "owner";
    hasBaton = group.current_baton_holder_id === user.id;
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
  }
  } // end if (!isDemo)

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-dark bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/groups" className="text-ink-light hover:text-ink">
              ← 戻る
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-moss">{group.name}</h1>
            {isOwner && <InviteButton groupId={id} />}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Baton Status */}
        <BatonStatus
          currentHolder={group.current_holder}
          hasBaton={hasBaton}
          groupId={id}
        />

        {/* Members */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-ink mb-4">メンバー</h2>
          <div className="flex flex-wrap gap-3">
            {members?.map((member) => (
              <div
                key={member.user?.id}
                className="flex items-center gap-2 bg-white border border-cream-dark rounded-full px-4 py-2"
              >
                <div className="w-8 h-8 bg-moss-light rounded-full flex items-center justify-center text-cream text-sm font-medium">
                  {member.user?.name?.charAt(0) ?? "?"}
                </div>
                <span className="text-sm text-ink">{member.user?.name}</span>
                {member.role === "owner" && (
                  <span className="text-xs text-moss bg-moss/10 px-2 py-0.5 rounded">
                    オーナー
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-ink">タイムライン</h2>
            {hasBaton && (
              <Link
                href={`/groups/${id}/new`}
                className="bg-moss text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-moss-dark transition-colors"
              >
                日記を書く
              </Link>
            )}
          </div>

          {!entries || entries.length === 0 ? (
            <div className="text-center py-12 bg-white border border-cream-dark rounded-xl">
              <div className="text-4xl mb-3">✏️</div>
              <p className="text-ink-light">
                {hasBaton
                  ? "あなたの番です！最初の日記を書きましょう"
                  : "まだ日記がありません"}
              </p>
              {hasBaton && (
                <Link
                  href={`/groups/${id}/new`}
                  className="inline-block mt-4 bg-moss text-cream px-6 py-3 rounded-lg font-medium hover:bg-moss-dark transition-colors"
                >
                  日記を書く
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/groups/${id}/entries/${entry.id}`}
                  className="block bg-white border border-cream-dark rounded-xl p-6 hover:border-moss transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-moss-light rounded-full flex items-center justify-center text-cream font-medium">
                      {entry.author?.name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                      <p className="font-medium text-ink">{entry.author?.name}</p>
                      <p className="text-xs text-ink-light">
                        {new Date(entry.created_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  {entry.body && (
                    <p className="text-ink-light line-clamp-3">{entry.body}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
