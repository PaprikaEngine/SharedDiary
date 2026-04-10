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
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-moss mb-2">
            メールを送信しました
          </h1>
          <p className="text-ink-light mb-6">
            {email} にパスワードリセット用のリンクを送信しました。
          </p>
          <Link
            href="/login"
            className="text-moss font-medium hover:underline"
          >
            ログインページに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-moss text-center mb-2">
          パスワードをリセット
        </h1>
        <p className="text-ink-light text-center mb-8">
          登録したメールアドレスを入力してください
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-moss focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moss text-cream px-6 py-3 rounded-lg font-medium hover:bg-moss-dark transition-colors disabled:opacity-50"
          >
            {loading ? "送信中..." : "リセットリンクを送信"}
          </button>
        </form>

        <p className="text-center mt-6 text-ink-light">
          <Link href="/login" className="text-moss font-medium hover:underline">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
