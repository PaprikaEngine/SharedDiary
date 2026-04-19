"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";

export default function NewGroupPage() {
  const [name, setName] = useState("");
  const [batonDeadlineDays, setBatonDeadlineDays] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("groups")
      .insert({ name, baton_deadline_days: Number(batonDeadlineDays), created_by: user.id })
      .select()
      .single();

    if (error) { setError(error.message); setLoading(false); return; }
    router.push(`/groups/${data.id}`);
    router.refresh();
  };

  const options = [
    { v: "1", l: "1日" },
    { v: "3", l: "3日" },
    { v: "7", l: "1週間" },
    { v: "14", l: "2週間" },
    { v: "30", l: "1ヶ月" },
  ];

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b rule-hair"
        style={{
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link href="/groups" className="btn btn-flat btn-sm">
            <ArrowLeft className="size-4" strokeWidth={1.6} />
            Library
          </Link>
          <span className="meta">New diary</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 md:px-10 py-12 reveal reveal-1">
        <h1 className="text-[28px] font-medium tracking-[-0.02em] t-hi mb-1.5">新しい日記帳</h1>
        <p className="text-[13.5px] t-md mb-9">名前を決めるだけ。仲間は後から招待できます。</p>

        {error && (
          <div
            className="mb-6 text-[13px] px-3.5 py-2.5 rounded-[8px] border"
            style={{
              borderColor: "var(--danger)",
              color: "var(--danger)",
              background: "var(--danger-soft)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          <div>
            <label htmlFor="name" className="block text-[13px] font-medium t-hi mb-2">
              日記帳の名前
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              placeholder="例: 高校の友達との日記"
              className="field field-lg"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium t-hi mb-2">
              バトンの期限
            </label>
            <div className="seg w-full">
              {options.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setBatonDeadlineDays(opt.v)}
                  data-active={batonDeadlineDays === opt.v}
                  className="flex-1"
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] t-lo">
              バトンを受けた人が書くまでの期限です。
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn btn-primary btn-lg"
            >
              {loading ? "作成中..." : "日記帳を作成"}
            </button>
            <Link href="/groups" className="btn btn-flat btn-lg">
              キャンセル
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
