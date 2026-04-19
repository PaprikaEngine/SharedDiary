"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
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
          <h1 className="text-[22px] font-medium tracking-tight t-hi mb-2">確認メールを送信しました</h1>
          <p className="text-[13.5px] t-md mb-7">
            <span className="font-mono t-hi">{email}</span> のリンクをクリックして登録を完了してください。
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

        <h1 className="text-[24px] font-medium tracking-[-0.02em] t-hi mb-1.5">アカウントを作る</h1>
        <p className="text-[13.5px] t-md mb-8">30秒で、日記帳をはじめよう。</p>

        {error && (
          <div className="mb-5 text-[13px] px-3.5 py-2.5 rounded-[8px] border" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-[12.5px] font-medium t-hi mb-1.5">
              ニックネーム
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="あなたのニックネーム"
              className="field"
            />
          </div>

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

          <div>
            <label htmlFor="password" className="block text-[12.5px] font-medium t-hi mb-1.5">
              パスワード
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

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block mt-2">
            {loading ? "登録中..." : "アカウントを作成"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <span className="flex-1 divider" />
          <span className="meta-sm">OR</span>
          <span className="flex-1 divider" />
        </div>

        <button onClick={handleGoogleSignup} className="btn btn-ghost btn-lg btn-block">
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Googleで登録
        </button>

        <p className="text-center text-[13px] t-md mt-8">
          すでにアカウントをお持ち?{" "}
          <Link href="/login" className="t-hi font-medium hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
