"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, AlertTriangle } from "lucide-react";

const CONFIRM_PHRASE = "退会する";

export function DeleteAccount() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any).rpc("delete_current_user");
    if (rpcErr) {
      setError(rpcErr.message);
      setSubmitting(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="paper-plain rounded-xl p-4 space-y-3 border border-destructive/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">アカウントを削除</p>
          <p className="text-xs text-ink-light leading-relaxed">
            退会すると、あなたの投稿・スタンプ・リアクションはすべて削除されます。参加中のグループからは自動的に抜け、あなたが最後のメンバーだった日記帳は一緒に削除されます。この操作は取り消せません。
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => { setConfirmText(""); setError(null); setOpen(true); }}
        className="h-9 text-xs rounded-lg px-4 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
      >
        退会する
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!submitting) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>本当に退会しますか？</DialogTitle>
            <DialogDescription>
              この操作は取り消せません。続行するには下の欄に「{CONFIRM_PHRASE}」と入力してください。
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            disabled={submitting}
            className="w-full h-10 px-3 bg-white border border-cream-dark rounded-lg text-sm focus:outline-none focus:border-destructive/60"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="h-9 text-xs rounded-lg px-4"
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={submitting || confirmText !== CONFIRM_PHRASE}
              className="h-9 text-xs rounded-lg px-4 bg-destructive hover:bg-destructive/90 text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "退会する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
