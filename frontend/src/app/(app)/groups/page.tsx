import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus, Settings, ArrowRight, BookOpen } from "lucide-react";

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function GroupsPage() {
  type GroupWithHolder = {
    id: string;
    name: string;
    current_holder: { name: string } | null;
  };

  let groups: GroupWithHolder[] | null = null;

  if (isDemo) {
    groups = [
      { id: "demo-1", name: "高校の友達との日記", current_holder: { name: "ともだち" } },
      { id: "demo-2", name: "大学サークルの交換日記", current_holder: { name: "あなた" } },
    ];
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: groupsData } = await (supabase as any)
        .from("groups")
        .select(`*, group_members!inner(user_id), current_holder:users!groups_current_baton_holder_id_fkey(name)`)
        .eq("group_members.user_id", user.id)
        .order("created_at", { ascending: false });

      groups = groupsData as GroupWithHolder[] | null;
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b rule-hair"
        style={{
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="size-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink)" }}>
                <div className="size-2.5 rounded-[3px]" style={{ background: "var(--signal)" }} />
              </div>
              <span className="font-medium text-[13.5px] tracking-tight">SharedDiary</span>
            </Link>
            <span className="t-xlo">/</span>
            <span className="meta">Library</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings" className="btn btn-flat btn-sm" aria-label="設定">
              <Settings className="size-4" strokeWidth={1.6} />
            </Link>
            <Link href="/groups/new" className="btn btn-primary btn-sm">
              <Plus className="size-4" strokeWidth={1.8} />
              新しい日記帳
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex items-end justify-between mb-8 reveal reveal-1">
          <div>
            <h1 className="text-[30px] font-medium tracking-[-0.02em] t-hi leading-none">日記帳</h1>
            <p className="mt-2 text-[13.5px] t-md">
              {groups?.length ?? 0} 冊 &nbsp;·&nbsp; 参加している日記帳の一覧
            </p>
          </div>
        </div>

        {!groups || groups.length === 0 ? (
          <div className="card p-16 flex flex-col items-center justify-center text-center reveal reveal-2">
            <div className="size-12 rounded-[10px] flex items-center justify-center mb-5" style={{ background: "var(--paper-alt)", color: "var(--ink-2)" }}>
              <BookOpen className="size-5" strokeWidth={1.5} />
            </div>
            <h2 className="text-[18px] font-medium tracking-tight t-hi mb-2">
              まだ日記帳がありません
            </h2>
            <p className="text-[13.5px] t-md mb-6 max-w-xs">
              最初の日記帳を作り、招待リンクで仲間を招きましょう。
            </p>
            <Link href="/groups/new" className="btn btn-primary">
              <Plus className="size-4" strokeWidth={1.8} />
              日記帳を作る
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 reveal reveal-2">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="card p-5 group flex flex-col gap-5 min-h-[150px]">
                <div className="flex items-start justify-between">
                  <div className="size-9 rounded-[9px] flex items-center justify-center" style={{ background: "var(--paper-alt)", color: "var(--ink-2)" }}>
                    <BookOpen className="size-4" strokeWidth={1.5} />
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity t-lo">
                    <ArrowRight className="size-4" strokeWidth={1.6} />
                  </span>
                </div>
                <div className="mt-auto">
                  <h2 className="text-[15.5px] font-medium tracking-tight t-hi leading-snug line-clamp-2">
                    {group.name}
                  </h2>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="dot dot-signal" />
                    <span className="meta">
                      {group.current_holder?.name ? `${group.current_holder.name} が次に書く` : "バトン未設定"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            <Link href="/groups/new" className="card p-5 flex flex-col items-center justify-center min-h-[150px] border-dashed" style={{ background: "transparent" }}>
              <div className="size-9 rounded-[9px] flex items-center justify-center mb-3" style={{ background: "var(--paper-alt)", color: "var(--ink-2)" }}>
                <Plus className="size-4" strokeWidth={1.8} />
              </div>
              <span className="text-[13.5px] font-medium t-md">新しい日記帳</span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
