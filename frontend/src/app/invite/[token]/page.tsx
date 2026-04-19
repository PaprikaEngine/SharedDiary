import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinGroupButton } from "./join-button";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  type Invitation = {
    id: string;
    token: string;
    expires_at: string | null;
    group: { id: string; name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitationData } = await (supabase as any)
    .from("group_invitations")
    .select(`
      *,
      group:groups(id, name)
    `)
    .eq("token", token)
    .single();

  const invitation = invitationData as Invitation | null;

  if (!invitation || !invitation.group) {
    return <State kicker="Invalid" headline="招待リンクが無効です" body="このリンクは期限切れか、既に使用されています。" />;
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return <State kicker="Expired" headline="招待リンクの期限が切れています" body="オーナーに新しい招待リンクを発行してもらってください。" />;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/invite/${token}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from("group_members")
    .select("user_id")
    .eq("group_id", invitation.group.id)
    .eq("user_id", user.id)
    .single();

  if (membership) {
    redirect(`/groups/${invitation.group.id}`);
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] text-center reveal reveal-1">
        <div className="w-12 h-12 rounded-[11px] flex items-center justify-center mx-auto mb-5" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7 8L10 11L13 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="meta">You&apos;re invited</span>
        <h1 className="text-[24px] font-medium tracking-[-0.02em] t-hi mt-3 mb-2">
          日記帳に招待されました
        </h1>
        <p className="text-[14px] t-md mb-7">
          「<span className="t-hi font-medium">{invitation.group.name}</span>」に参加しませんか?
        </p>
        <JoinGroupButton groupId={invitation.group.id} token={token} />
      </div>
    </div>
  );
}

function State({ kicker, headline, body }: { kicker: string; headline: string; body: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px] text-center">
        <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mx-auto mb-5" style={{ background: "var(--paper-alt)", color: "var(--ink-3)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 6L12 12M12 6L6 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
        <span className="meta">{kicker}</span>
        <h1 className="text-[20px] font-medium tracking-tight t-hi mt-2 mb-2">{headline}</h1>
        <p className="text-[13.5px] t-md">{body}</p>
      </div>
    </div>
  );
}
