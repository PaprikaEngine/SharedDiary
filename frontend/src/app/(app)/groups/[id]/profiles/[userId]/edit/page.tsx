"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EntryComposer, type ProfileMember } from "../../../_components/entry-composer";

// Profile editor — only the profile owner can edit their own page.
// Anyone else lands on the read-only display route. The auth check
// runs client-side; the entries RLS policy enforces it server-side
// (delete + insert both require entry author === auth.uid()).
export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const userId = params.userId as string;
  const [member, setMember] = useState<ProfileMember | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (user.id !== userId) {
        // Non-owners get bounced to the read-only display.
        router.replace(`/groups/${groupId}/profiles/${userId}`);
        return;
      }
      // Verify the user is a member of this group + grab display name.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await (supabase as any)
        .from("group_members")
        .select("user:users(id, name)")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .single();
      if (cancelled) return;
      if (!row) { setStatus("missing"); return; }
      const r = row as { user: { id: string; name: string } | null };
      setMember({ userId, name: r.user?.name ?? "" });
      setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [groupId, userId, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-ink-light" />
      </div>
    );
  }
  if (status === "missing") {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-light text-sm">
        メンバーが見つかりませんでした
      </div>
    );
  }
  if (status !== "ok" || !member) return null;

  return <EntryComposer groupId={groupId} mode="profile" profileMember={member} />;
}
