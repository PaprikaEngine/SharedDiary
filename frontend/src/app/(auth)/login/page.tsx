"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
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

  const handleGoogleLogin = async () => {
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px] reveal reveal-1">
        <Link href="/" className="flex items-center gap-2.5 mb-8">
          <div className="w-6 h-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink)" }}>
            <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--signal)" }} />
          </div>
          <span className="font-medium text-[13.5px] tracking-tight">SharedDiary</span>
        </Link>

        <h1 className="text-[24px] font-medium tracking-[-0.02em] t-hi mb-1.5">ログイン</h1>
        <p className="text-[13.5px] t-md mb-8">つづきの頁を開きましょう。</p>

        {error && (
          <div className="mb-5 text-[13px] px-3.5 py-2.5 rounded-[8px] border" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-[12.5px] font-medium t-hi">
                パスワード
              </label>
              <Link href="/reset-password" className="text-[12px] t-md hover:t-hi">
                忘れた?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="field"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block mt-2">
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <span className="flex-1 divider" />
          <span className="meta-sm">OR</span>
          <span className="flex-1 divider" />
        </div>

        <button onClick={handleGoogleLogin} className="btn btn-ghost btn-lg btn-block">
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Googleで続ける
        </button>

        <p className="text-center text-[13px] t-md mt-8">
          アカウントがない?{" "}
          <Link href="/signup" className="t-hi font-medium hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
