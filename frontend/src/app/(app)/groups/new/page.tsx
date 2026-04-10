"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NewGroupPage() {
  const [name, setName] = useState("");
  const [batonDeadlineDays, setBatonDeadlineDays] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name,
        baton_deadline_days: batonDeadlineDays,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/groups/${data.id}`);
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-cream-dark bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/groups" className="text-ink-light hover:text-ink">
            ← 戻る
          </Link>
          <h1 className="text-2xl font-bold text-moss">新しい日記帳</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <div className="bg-white border border-cream-dark rounded-xl p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink mb-2">
                日記帳の名前
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-moss focus:border-transparent"
                placeholder="例: 高校の友達との日記"
              />
            </div>

            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-ink mb-2">
                バトンの期限（日数）
              </label>
              <p className="text-sm text-ink-light mb-2">
                バトンを持っている人が書く期限です
              </p>
              <select
                id="deadline"
                value={batonDeadlineDays}
                onChange={(e) => setBatonDeadlineDays(Number(e.target.value))}
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-moss focus:border-transparent"
              >
                <option value={1}>1日</option>
                <option value={3}>3日</option>
                <option value={7}>1週間</option>
                <option value={14}>2週間</option>
                <option value={30}>1ヶ月</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-moss text-cream px-6 py-3 rounded-lg font-medium hover:bg-moss-dark transition-colors disabled:opacity-50"
            >
              {loading ? "作成中..." : "日記帳を作成"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-light mt-6">
          作成後、招待リンクで友達を招待できます
        </p>
      </main>
    </div>
  );
}
