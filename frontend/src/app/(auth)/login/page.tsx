"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Paper card */}
        <div className="paper-plain rounded-xl p-6 relative">
          <div className="text-center mb-6">
            <Link href="/" className="text-lg font-bold text-moss" style={{ fontFamily: "var(--font-handwriting)" }}>
              SharedDiary
            </Link>
            <p className="text-sm text-ink-light mt-1">おかえりなさい</p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-ink-light">メールアドレス</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs text-ink-light">パスワード</Label>
                <Link href="/reset-password" className="text-xs text-moss hover:underline">忘れた方</Link>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" className="h-10" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10 bg-moss hover:bg-moss-dark">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "ログイン"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-cream-dark" />
            <span className="text-xs text-ink-light/50">or</span>
            <div className="flex-1 h-px bg-cream-dark" />
          </div>

          <Button variant="outline" onClick={handleGoogleLogin} className="w-full h-10">
            <svg className="size-4 mr-1" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11.98 11.98 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Googleでログイン
          </Button>
        </div>

        <p className="text-center text-sm text-ink-light/70 mt-5">
          はじめての方は{" "}
          <Link href="/signup" className="text-moss hover:underline">新規登録</Link>
        </p>
      </div>
    </div>
  );
}
