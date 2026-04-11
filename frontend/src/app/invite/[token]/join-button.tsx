"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

type Props = { groupId: string; token: string };

export function JoinGroupButton({ groupId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleJoin = async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
    if (error) { setError(error.message); setLoading(false); return; }

    router.push(`/groups/${groupId}`);
    router.refresh();
  };

  return (
    <div>
      {error && (
        <div className="text-sm text-destructive bg-destructive/8 border border-destructive/15 rounded-lg px-3 py-2 mb-4">{error}</div>
      )}
      <button onClick={handleJoin} disabled={loading}
        className="w-full h-10 rounded-xl bg-moss hover:bg-moss-dark text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="size-4 animate-spin" /> 参加中...</> : "日記帳に参加する"}
      </button>
    </div>
  );
}
