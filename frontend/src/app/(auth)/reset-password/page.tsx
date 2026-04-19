"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-[380px] text-center">
          <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mx-auto mb-5" style={{ background: "var(--paper-alt)", color: "var(--ink-2)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <rect x="2.5" y="4" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2.5 5L9 10L15.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-medium tracking-tight t-hi mb-2">メールを送信しました</h1>
          <p className="text-[13.5px] t-md mb-7">
            <span className="font-mono t-hi">{email}</span> にパスワード再設定のリンクを送りました。
          </p>
          <Link href="/login" className="btn btn-ghost">
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px] reveal reveal-1">
        <Link href="/" className="flex items-center gap-2.5 mb-8">
          <div className="w-6 h-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink)" }}>
            <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--signal)" }} />
          </div>
          <span className="font-medium text-[13.5px] tracking-tight">SharedDiary</span>
        </Link>

        <h1 className="text-[24px] font-medium tracking-[-0.02em] t-hi mb-1.5">パスワードを再設定</h1>
        <p className="text-[13.5px] t-md mb-8">登録したメールアドレスを入力してください。</p>

        {error && (
          <div className="mb-5 text-[13px] px-3.5 py-2.5 rounded-[8px] border" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[12.5px] font-medium t-hi mb-1.5">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="field"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block mt-2">
            {loading ? "送信中..." : "リセットリンクを送信"}
          </button>
        </form>

        <p className="text-center text-[13px] t-md mt-8">
          <Link href="/login" className="t-hi font-medium hover:underline">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
