import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: groups } = await supabase
    .from("groups")
    .select(`
      *,
      group_members!inner(user_id),
      current_holder:users!groups_current_baton_holder_id_fkey(name)
    `)
    .eq("group_members.user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-dark bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-moss">日記帳</h1>
          <Link
            href="/groups/new"
            className="bg-moss text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-moss-dark transition-colors"
          >
            新しい日記帳
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!groups || groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📔</div>
            <h2 className="text-xl font-medium text-ink mb-2">
              まだ日記帳がありません
            </h2>
            <p className="text-ink-light mb-6">
              新しい日記帳を作って、友達と交換日記を始めましょう
            </p>
            <Link
              href="/groups/new"
              className="inline-block bg-moss text-cream px-6 py-3 rounded-lg font-medium hover:bg-moss-dark transition-colors"
            >
              日記帳を作る
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="block bg-white border border-cream-dark rounded-xl p-6 hover:border-moss transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-medium text-ink mb-1">
                      {group.name}
                    </h2>
                    <p className="text-sm text-ink-light">
                      バトン: {group.current_holder?.name ?? "未設定"}
                    </p>
                  </div>
                  <div className="text-3xl">📓</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
