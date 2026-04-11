"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

    if (password !== confirmPassword) { setError("パスワードが一致しません"); return; }
    if (password.length < 6) { setError("パスワードは6文字以上で入力してください"); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="paper-plain rounded-xl p-6">
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-ink">新しいパスワード</h1>
            <p className="text-sm text-ink-light mt-1">新しいパスワードを入力してください</p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">{error}</div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-ink-light">新しいパスワード</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="6文字以上" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs text-ink-light">パスワード（確認）</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} placeholder="もう一度入力" className="h-10" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10 bg-moss hover:bg-moss-dark">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "パスワードを更新"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
