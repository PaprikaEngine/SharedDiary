"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  groupId: string;
  token: string;
};

export function JoinGroupButton({ groupId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleJoin = async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です");
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("group_members")
      .insert({
        group_id: groupId,
        user_id: user.id,
        role: "member",
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/groups/${groupId}`);
    router.refresh();
  };

  return (
    <div>
      {error && (
        <p className="text-red-600 text-sm mb-4">{error}</p>
      )}
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full bg-moss text-cream px-6 py-3 rounded-lg font-medium hover:bg-moss-dark transition-colors disabled:opacity-50"
      >
        {loading ? "参加中..." : "日記帳に参加する"}
      </button>
    </div>
  );
}
