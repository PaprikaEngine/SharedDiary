"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Check, Loader2 } from "lucide-react";

type Props = { groupId: string };

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

    const token = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("group_invitations").insert({
      group_id: groupId, token, created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    if (error) { console.error(error); setLoading(false); return; }

    setInviteUrl(`${window.location.origin}/invite/${token}`);
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
      <button onClick={generateInvite} disabled={loading} className="text-xs text-moss hover:text-moss-dark flex items-center gap-1 transition-colors disabled:opacity-50">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
        招待
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-cream">
          <DialogHeader>
            <DialogTitle className="text-base">招待リンク</DialogTitle>
            <DialogDescription>友達にこのリンクを送りましょう</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={inviteUrl ?? ""} readOnly className="text-xs h-9" />
            <Button size="icon" variant="outline" onClick={copyToClipboard} className="shrink-0 size-9">
              {copied ? <Check className="size-4 text-moss" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-ink-light/50 text-center">7日間有効</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
