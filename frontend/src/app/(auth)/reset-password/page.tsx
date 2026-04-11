"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="paper-plain rounded-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="text-lg font-semibold text-ink mb-2">メールを送信しました</h1>
          <p className="text-sm text-ink-light leading-relaxed mb-6">
            {email} にリセット用リンクを送りました。
          </p>
          <Link href="/login" className="text-sm text-moss hover:underline">ログインへ戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="paper-plain rounded-xl p-6">
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-ink">パスワードをリセット</h1>
            <p className="text-sm text-ink-light mt-1">登録メールアドレスを入力</p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">{error}</div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-ink-light">メールアドレス</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="h-10" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10 bg-moss hover:bg-moss-dark">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "リセットリンクを送信"}
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-light/70 mt-5">
          <Link href="/login" className="text-moss hover:underline">ログインに戻る</Link>
        </p>
      </div>
    </div>
  );
}
