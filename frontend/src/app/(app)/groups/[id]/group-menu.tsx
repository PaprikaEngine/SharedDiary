"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Loader2, LogOut, Shuffle, SkipForward } from "lucide-react";

type Member = {
  id: string;
  name: string;
};

type Props = {
  groupId: string;
  currentUserId: string;
  isOwner: boolean;
  hasBaton: boolean;
  currentHolderId: string | null;
  members: Member[];
};

type Mode = "menu" | "leave" | "reassign" | "skip";

export function GroupMenu({ groupId, currentUserId, isOwner, hasBaton, currentHolderId, members }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const reset = () => {
    setMode("menu");
    setBusy(false);
    setError(null);
    setSelectedMember(null);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTimeout(reset, 200);
  };

  const others = members.filter((m) => m.id !== currentUserId);
  const othersExcludingHolder = members.filter((m) => m.id !== currentHolderId);

  const runLeave = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc("leave_group", { p_group_id: groupId });
    if (rpcError) { setError(rpcError.message); setBusy(false); return; }
    router.push("/groups");
    router.refresh();
  };

  const runPassBaton = async (targetId: string) => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc("pass_baton", {
      p_group_id: groupId,
      p_new_holder_id: targetId,
    });
    if (rpcError) { setError(rpcError.message); setBusy(false); return; }
    close();
    router.refresh();
  };

  // Owner can reassign any time; the current baton holder can skip their own turn.
  // Either case needs at least one other member to hand off to.
  const canReassign = isOwner && othersExcludingHolder.length > 0;
  const canSkip = hasBaton && others.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink-light hover:text-ink transition-colors"
        title="グループ設定"
      >
        <MoreHorizontal className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md bg-cream">
          {mode === "menu" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">グループ設定</DialogTitle>
                <DialogDescription>バトンの操作やグループからの離脱ができます</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1 -mx-2">
                {canReassign && (
                  <button
                    type="button"
                    onClick={() => { setMode("reassign"); setSelectedMember(othersExcludingHolder[0]?.id ?? null); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-cream-dark/40 transition-colors"
                  >
                    <Shuffle className="size-4 text-moss shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">バトンの順番を変更</p>
                      <p className="text-xs text-ink-light/60">次に書く人を選び直します</p>
                    </div>
                  </button>
                )}
                {canSkip && (
                  <button
                    type="button"
                    onClick={() => { setMode("skip"); setSelectedMember(others[0]?.id ?? null); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-cream-dark/40 transition-colors"
                  >
                    <SkipForward className="size-4 text-moss shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">今回はスキップ</p>
                      <p className="text-xs text-ink-light/60">書かずに次の人にバトンを渡します</p>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode("leave")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-red-50 transition-colors"
                >
                  <LogOut className="size-4 text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-500">グループから離脱</p>
                    <p className="text-xs text-ink-light/60">
                      {isOwner ? "オーナー権限は次のバトンの人に引き継がれます" : "このグループから抜けます"}
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}

          {mode === "reassign" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">バトンを渡す相手を選ぶ</DialogTitle>
                <DialogDescription>新しくバトンを持つ人を選んでください</DialogDescription>
              </DialogHeader>
              <MemberPicker
                members={othersExcludingHolder}
                selected={selectedMember}
                onSelect={setSelectedMember}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("menu")} disabled={busy}>戻る</Button>
                <Button
                  onClick={() => selectedMember && runPassBaton(selectedMember)}
                  disabled={busy || !selectedMember}
                  className="bg-moss hover:bg-moss-dark text-white"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "バトンを渡す"}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === "skip" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">今回はスキップ</DialogTitle>
                <DialogDescription>書かずに次の人にバトンを渡します</DialogDescription>
              </DialogHeader>
              <MemberPicker
                members={others}
                selected={selectedMember}
                onSelect={setSelectedMember}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("menu")} disabled={busy}>戻る</Button>
                <Button
                  onClick={() => selectedMember && runPassBaton(selectedMember)}
                  disabled={busy || !selectedMember}
                  className="bg-moss hover:bg-moss-dark text-white"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "スキップする"}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === "leave" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">グループから離脱しますか?</DialogTitle>
                <DialogDescription>
                  {isOwner
                    ? "オーナー権限は次にバトンを持っている人に引き継がれます。あなたの過去の日記はそのまま残ります。"
                    : "このグループに戻るには、もう一度招待が必要です。あなたの過去の日記はそのまま残ります。"}
                </DialogDescription>
              </DialogHeader>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("menu")} disabled={busy}>戻る</Button>
                <Button
                  onClick={runLeave}
                  disabled={busy}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "離脱する"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MemberPicker({
  members,
  selected,
  onSelect,
}: {
  members: Member[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (members.length === 0) {
    return <p className="text-xs text-ink-light">他にメンバーがいません</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === m.id
              ? "bg-moss text-white"
              : "bg-cream-dark/60 text-ink-light hover:bg-cream-dark"
          }`}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}
