"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  groupId: string;
};

export function InviteButton({ groupId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  const generateInvite = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate a random token
    const token = crypto.randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("group_invitations")
      .insert({
        group_id: groupId,
        token,
        created_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });

    if (error) {
      console.error("Failed to create invite:", error);
      setLoading(false);
      return;
    }

    const url = `${window.location.origin}/invite/${token}`;
    setInviteUrl(url);
    setLoading(false);
    setIsOpen(true);
  };

  const copyToClipboard = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button onClick={generateInvite} disabled={loading} className="btn btn-ghost btn-sm">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {loading ? "生成中..." : "招待"}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fadeIn"
          style={{ background: "rgba(24,24,22,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="card w-full max-w-[420px] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-medium tracking-tight t-hi">招待リンク</h2>
                <p className="text-[13px] t-md mt-0.5">リンクを送って、仲間を招きましょう。</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="t-lo hover:t-hi"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="rounded-[9px] p-3 mb-4 border" style={{ background: "var(--paper-alt)", borderColor: "var(--stroke)" }}>
              <p className="font-mono text-[12px] break-all t-hi leading-relaxed">{inviteUrl}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={copyToClipboard} className="btn btn-primary flex-1">
                {copied ? "コピーしました" : "リンクをコピー"}
              </button>
              <button onClick={() => setIsOpen(false)} className="btn btn-ghost">
                閉じる
              </button>
            </div>

            <p className="meta-sm text-center mt-4">7日間有効</p>
          </div>
        </div>
      )}
    </>
  );
}
