import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinGroupButton } from "./join-button";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  type Invitation = { id: string; token: string; expires_at: string | null; group: { id: string; name: string } | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitationData } = await (supabase as any).from("group_invitations").select(`*, group:groups(id, name)`).eq("token", token).single();
  const invitation = invitationData as Invitation | null;

  if (!invitation || !invitation.group) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="paper-plain rounded-xl p-8 max-w-xs text-center">
          <div className="text-3xl mb-3">😢</div>
          <p className="font-semibold text-ink mb-1">招待リンクが無効です</p>
          <p className="text-sm text-ink-light/60">期限切れか、既に使用されています</p>
        </div>
      </div>
    );
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="paper-plain rounded-xl p-8 max-w-xs text-center">
          <div className="text-3xl mb-3">⏰</div>
          <p className="font-semibold text-ink mb-1">期限切れです</p>
          <p className="text-sm text-ink-light/60">オーナーに新しい招待リンクを発行してもらってください</p>
        </div>
      </div>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any).from("group_members").select("user_id").eq("group_id", invitation.group.id).eq("user_id", user.id).single();
  if (membership) redirect(`/groups/${invitation.group.id}`);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="paper-plain rounded-xl p-8 max-w-xs w-full text-center relative tape">
        <div className="text-3xl mb-3">📔</div>
        <p className="font-semibold text-moss mb-1">日記帳への招待</p>
        <p className="text-sm text-ink-light mb-6">
          「<span className="font-medium text-ink">{invitation.group.name}</span>」に招待されています
        </p>
        <JoinGroupButton groupId={invitation.group.id} token={token} />
      </div>
    </div>
  );
}
