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
    { id: "demo-1", body: "今日はいい天気だったね。公園でアイスを食べたよ。", created_at: new Date().toISOString(), author: { name: "ともだち", avatar_url: null } },
    { id: "demo-2", body: "昨日は映画を見に行ったよ。すごくおもしろかった。また一緒に行こう。", created_at: new Date(Date.now() - 86400000).toISOString(), author: { name: "あなた", avatar_url: null } },
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
      <header className="sticky top-0 z-10 border-b rule-hair" style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/groups" className="btn btn-flat btn-sm">
              <ArrowLeft />
              Library
            </Link>
            <span className="t-xlo">/</span>
            <span className="text-[13.5px] font-medium t-hi truncate max-w-[200px] md:max-w-[360px]">{group.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && <InviteButton groupId={id} />}
            {hasBaton && (
              <Link href={`/groups/${id}/new`} className="btn btn-primary btn-sm">
                <Plus />
                日記を書く
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        {/* Title row */}
        <div className="mb-7 flex items-start justify-between gap-6 reveal reveal-1">
          <div>
            <h1 className="text-[32px] md:text-[40px] font-medium tracking-[-0.025em] t-hi leading-[1.1]">
              {group.name}
            </h1>
            <p className="mt-2 text-[13.5px] t-md">
              {entries?.length ?? 0} 件の日記 &nbsp;·&nbsp; {members?.length ?? 0} 名
            </p>
          </div>
        </div>

        {/* Baton + Members layout: 2 column on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10 reveal reveal-2">
          <div className="lg:col-span-2">
            <BatonStatus
              currentHolder={group.current_holder}
              hasBaton={hasBaton}
              groupId={id}
            />
          </div>

          {/* Members card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="meta">Members</span>
              <span className="meta-sm">{members?.length ?? 0}</span>
            </div>
            <ul className="space-y-2.5">
              {members?.map((member) => (
                <li key={member.user?.id} className="flex items-center gap-3">
                  <div className="avatar">
                    {member.user?.name?.charAt(0) ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium t-hi truncate">{member.user?.name}</p>
                  </div>
                  {member.role === "owner" && (
                    <span className="chip">Owner</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Entries list */}
        <section className="reveal reveal-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[15px] font-medium t-hi">日記</h2>
              <span className="meta">{entries?.length ?? 0}</span>
            </div>
          </div>

          {!entries || entries.length === 0 ? (
            <div className="card p-14 flex flex-col items-center justify-center text-center">
              <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-4" style={{ background: "var(--paper-alt)", color: "var(--ink-2)" }}>
                <WriteIcon />
              </div>
              <p className="text-[14.5px] font-medium t-hi mb-1.5">
                {hasBaton ? "あなたから書きはじめましょう" : "まだ日記がありません"}
              </p>
              <p className="text-[13px] t-md mb-5">
                {hasBaton ? "最初の1頁を書くと、次の人にバトンが渡ります。" : "バトンを持っている人が書くのを待ちましょう。"}
              </p>
              {hasBaton && (
                <Link href={`/groups/${id}/new`} className="btn btn-primary">
                  <Plus />
                  日記を書く
                </Link>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <ul className="divide-y" style={{ borderColor: "var(--stroke)" }}>
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/groups/${id}/entries/${entry.id}`}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--paper-alt)] transition-colors group"
                    >
                      <div className="avatar avatar-lg mt-0.5">
                        {entry.author?.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2.5 mb-1">
                          <span className="text-[14px] font-medium t-hi">{entry.author?.name}</span>
                          <span className="meta-sm">
                            {new Date(entry.created_at).toLocaleDateString("ja-JP", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        {entry.body && (
                          <p className="text-[13.5px] leading-[1.6] t-md line-clamp-2">
                            {entry.body}
                          </p>
                        )}
                      </div>
                      <span className="t-xlo opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                        <ArrowRight />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M11 7H3M3 7L6.5 3.5M3 7L6.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Plus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 2V11M2 6.5H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function WriteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10.5 2L14 5.5L6 13.5L2.5 13.5L2.5 10L10.5 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
