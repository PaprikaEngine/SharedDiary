import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";

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
      {/* Header */}
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-moss" style={{ fontFamily: "var(--font-handwriting)" }}>
            SharedDiary
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/settings" className="text-ink-light hover:text-ink transition-colors p-1.5">
              <Settings className="size-4" />
            </Link>
            <Button asChild size="sm" className="bg-moss hover:bg-moss-dark rounded-full h-8 px-3 text-xs">
              <Link href="/groups/new">
                <Plus className="size-3.5" />
                新しい日記帳
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <p className="text-xs text-ink-light/60 tracking-wider uppercase mb-5">My Diaries</p>

        {!groups || groups.length === 0 ? (
          <div className="paper-plain rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">📔</div>
            <p className="text-ink-light mb-1">まだ日記帳がありません</p>
            <p className="text-sm text-ink-light/60 mb-5">新しい日記帳を作って、友達を招待しましょう</p>
            <Button asChild className="bg-moss hover:bg-moss-dark rounded-full">
              <Link href="/groups/new">日記帳を作る</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="block group">
                <div className="paper-plain rounded-xl px-5 py-4 flex items-center gap-4 transition-shadow hover:shadow-md">
                  {/* Book spine color */}
                  <div className="w-2 self-stretch rounded-full bg-moss/25 group-hover:bg-moss/50 transition-colors shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink group-hover:text-moss transition-colors truncate">
                      {group.name}
                    </h2>
                    <p className="text-xs text-ink-light/60 mt-0.5">
                      🎀 {group.current_holder?.name ?? "未設定"}
                    </p>
                  </div>
                  <span className="text-ink-light/30 group-hover:text-ink-light/60 transition-colors text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
