import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinGroupButton } from "./join-button";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  // Get invitation details
  const { data: invitation } = await supabase
    .from("group_invitations")
    .select(`
      *,
      group:groups(id, name)
    `)
    .eq("token", token)
    .single();

  if (!invitation || !invitation.group) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-2xl font-bold text-ink mb-2">
            招待リンクが無効です
          </h1>
          <p className="text-ink-light">
            このリンクは期限切れか、既に使用されています
          </p>
        </div>
      </div>
    );
  }

  // Check if expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-ink mb-2">
            招待リンクの期限が切れています
          </h1>
          <p className="text-ink-light">
            オーナーに新しい招待リンクを発行してもらってください
          </p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login with return URL
    redirect(`/login?next=/invite/${token}`);
  }

  // Check if already a member
  const { data: membership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", invitation.group.id)
    .eq("user_id", user.id)
    .single();

  if (membership) {
    redirect(`/groups/${invitation.group.id}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">📔</div>
        <h1 className="text-2xl font-bold text-moss mb-2">
          日記帳への招待
        </h1>
        <p className="text-ink mb-6">
          「<span className="font-medium">{invitation.group.name}</span>」に招待されています
        </p>
        <JoinGroupButton groupId={invitation.group.id} token={token} />
      </div>
    </div>
  );
}
