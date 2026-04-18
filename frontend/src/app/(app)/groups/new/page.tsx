"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";

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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link href="/groups" className="text-ink-light hover:text-ink transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold text-ink">新しい日記帳</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 py-8">
        <div className="paper-plain rounded-xl p-6">
          {error && (
            <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-ink-light">日記帳の名前</Label>
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="例: 高校の友達との日記" className="h-10" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deadline" className="text-xs text-ink-light">バトンの期限</Label>
              <p className="text-xs text-ink-light/60">次の人が書くまでの期限です</p>
              <Select value={batonDeadlineDays} onValueChange={setBatonDeadlineDays}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1日</SelectItem>
                  <SelectItem value="3">3日</SelectItem>
                  <SelectItem value="7">1週間</SelectItem>
                  <SelectItem value="14">2週間</SelectItem>
                  <SelectItem value="30">1ヶ月</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading || !name.trim()} className="w-full h-10 bg-moss hover:bg-moss-dark">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "日記帳を作成"}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-ink-light/50 mt-5">作成後、招待リンクで友達を招待できます</p>
      </main>
    </div>
  );
}
