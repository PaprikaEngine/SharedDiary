"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px] reveal reveal-1">
        <Link href="/" className="flex items-center gap-2.5 mb-8">
          <div className="w-6 h-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink)" }}>
            <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--signal)" }} />
          </div>
          <span className="font-medium text-[13.5px] tracking-tight">SharedDiary</span>
        </Link>

        <h1 className="text-[24px] font-medium tracking-[-0.02em] t-hi mb-1.5">新しいパスワード</h1>
        <p className="text-[13.5px] t-md mb-8">新しいパスワードを設定してください。</p>

        {error && (
          <div className="mb-5 text-[13px] px-3.5 py-2.5 rounded-[8px] border" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-[12.5px] font-medium t-hi mb-1.5">
              新しいパスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="6文字以上"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-[12.5px] font-medium t-hi mb-1.5">
              確認
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="もう一度入力"
              className="field"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block mt-2">
            {loading ? "更新中..." : "パスワードを更新"}
          </button>
        </form>
      </div>
    </div>
  );
}
