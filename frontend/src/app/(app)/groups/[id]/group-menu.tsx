"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Loader2, LogOut, ArrowUp, ArrowDown, SkipForward, User } from "lucide-react";

type Member = {
  id: string;
  name: string;
  memberOrder?: number;
};

type Props = {
  groupId: string;
  currentUserId: string;
  isOwner: boolean;
  hasBaton: boolean;
  currentUserDisplayName: string | null;
  members: Member[];
};

type Mode = "menu" | "leave" | "reorder" | "skip" | "self-name";

export function GroupMenu({ groupId, currentUserId, isOwner, hasBaton, currentUserDisplayName, members }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reorderList, setReorderList] = useState<Member[]>([]);
  const [selfNameDraft, setSelfNameDraft] = useState(currentUserDisplayName ?? "");

  const reset = () => {
    setMode("menu");
    setBusy(false);
    setError(null);
    setReorderList([]);
    setSelfNameDraft(currentUserDisplayName ?? "");
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTimeout(reset, 200);
  };

  const others = members.filter((m) => m.id !== currentUserId);

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

  const runSkip = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc("advance_baton_in_order", { p_group_id: groupId });
    if (rpcError) { setError(rpcError.message); setBusy(false); return; }
    close();
    router.refresh();
  };

  const runReorderSequence = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc("reorder_baton_sequence", {
      p_group_id: groupId,
      p_ordered_user_ids: reorderList.map((m) => m.id),
    });
    if (rpcError) { setError(rpcError.message); setBusy(false); return; }
    close();
    router.refresh();
  };

  const runSelfName = async () => {
    const trimmed = selfNameDraft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === (currentUserDisplayName ?? null)) { close(); return; }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (supabase as any)
      .from("group_members")
      .update({ display_name: next })
      .eq("group_id", groupId)
      .eq("user_id", currentUserId);
    if (updErr) { setError(updErr.message); setBusy(false); return; }
    close();
    router.refresh();
  };

  const canReorder = isOwner && members.length > 1;
  const canSkip = hasBaton && others.length > 0;

  const moveUp = (index: number) => {
    if (index === 0) return;
    setReorderList((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setReorderList((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-flat btn-sm"
        title="グループ設定"
        aria-label="グループ設定"
      >
        <MoreHorizontal className="size-4" strokeWidth={1.6} />
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
                {canReorder && (
                  <button
                    type="button"
                    onClick={() => {
                      const sorted = [...members].sort((a, b) => (a.memberOrder ?? 0) - (b.memberOrder ?? 0));
                      setReorderList(sorted);
                      setMode("reorder");
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-cream-dark/40 transition-colors"
                  >
                    <ArrowUp className="size-4 text-moss shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">バトンの順番を変更</p>
                      <p className="text-xs text-ink-light/60">書く順番を並べ替えます</p>
                    </div>
                  </button>
                )}
                {canSkip && (
                  <button
                    type="button"
                    onClick={() => setMode("skip")}
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
                  onClick={() => { setMode("self-name"); setSelfNameDraft(currentUserDisplayName ?? ""); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-cream-dark/40 transition-colors"
                >
                  <User className="size-4 text-moss shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">このグループでの表示名</p>
                    <p className="text-xs text-ink-light/60">
                      {currentUserDisplayName ? `現在: ${currentUserDisplayName}` : "プロフィールの名前を使用中"}
                    </p>
                  </div>
                </button>
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

          {mode === "reorder" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">バトンの順番を変更</DialogTitle>
                <DialogDescription>上下の矢印で書く順番を並べ替えてください</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1">
                {reorderList.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-cream-dark/30">
                    <span className="w-5 text-center text-xs text-ink-light/50 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-ink">{m.name}</span>
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="p-1 rounded hover:bg-cream-dark transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      disabled={i === reorderList.length - 1}
                      className="p-1 rounded hover:bg-cream-dark transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("menu")} disabled={busy}>戻る</Button>
                <Button
                  onClick={runReorderSequence}
                  disabled={busy}
                  className="bg-moss hover:bg-moss-dark text-white"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "保存する"}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === "skip" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">今回はスキップ</DialogTitle>
                <DialogDescription>書かずに次の順番の人にバトンを渡します。よろしいですか？</DialogDescription>
              </DialogHeader>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("menu")} disabled={busy}>戻る</Button>
                <Button
                  onClick={runSkip}
                  disabled={busy}
                  className="bg-moss hover:bg-moss-dark text-white"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "スキップする"}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === "self-name" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">このグループでの表示名</DialogTitle>
                <DialogDescription>
                  このグループでだけ使う表示名を設定できます。空欄にするとプロフィールの名前に戻ります。
                </DialogDescription>
              </DialogHeader>
              <Input
                type="text"
                value={selfNameDraft}
                onChange={(e) => setSelfNameDraft(e.target.value)}
                maxLength={30}
                placeholder="例: ともちゃん"
                className="h-10"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("menu")} disabled={busy}>戻る</Button>
                <Button
                  onClick={runSelfName}
                  disabled={busy || selfNameDraft.trim() === (currentUserDisplayName ?? "")}
                  className="bg-moss hover:bg-moss-dark text-white"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "保存する"}
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
