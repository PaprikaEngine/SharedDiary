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
      <button
        onClick={generateInvite}
        disabled={loading}
        className="border border-moss text-moss px-4 py-2 rounded-lg text-sm font-medium hover:bg-moss hover:text-cream transition-colors disabled:opacity-50"
      >
        {loading ? "生成中..." : "招待リンク"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-moss mb-2">招待リンク</h2>
            <p className="text-sm text-ink-light mb-4">
              このリンクを友達に送って、日記帳に招待しましょう
            </p>

            <div className="bg-white border border-cream-dark rounded-lg p-3 mb-4">
              <p className="text-sm text-ink break-all">{inviteUrl}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-moss text-cream px-4 py-2 rounded-lg font-medium hover:bg-moss-dark transition-colors"
              >
                {copied ? "コピーしました!" : "コピー"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 border border-ink-light text-ink px-4 py-2 rounded-lg font-medium hover:bg-cream-dark transition-colors"
              >
                閉じる
              </button>
            </div>

            <p className="text-xs text-ink-light text-center mt-4">
              このリンクは7日間有効です
            </p>
          </div>
        </div>
      )}
    </>
  );
}
