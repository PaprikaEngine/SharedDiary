"use client";

import Link from "next/link";

type User = {
  id: string;
  name: string;
  avatar_url: string | null;
} | null;

type Props = {
  currentHolder: User;
  hasBaton: boolean;
  groupId: string;
};

export function BatonStatus({ currentHolder, hasBaton, groupId }: Props) {
  return (
    <div className="card p-5 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="avatar avatar-xl mt-0.5" style={hasBaton ? { background: "var(--signal)", borderColor: "var(--signal)", color: "var(--paper)" } : undefined}>
            {currentHolder?.name?.charAt(0) ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`dot ${hasBaton ? "dot-signal pulse-signal" : ""}`} style={hasBaton ? undefined : { background: "var(--ink-3)" }} />
              <span className="meta">Current baton</span>
            </div>
            {currentHolder ? (
              <p className="text-[20px] md:text-[22px] font-medium tracking-[-0.01em] t-hi leading-tight">
                {hasBaton ? "あなたの番" : `${currentHolder.name} が書いています`}
              </p>
            ) : (
              <p className="text-[20px] font-medium tracking-[-0.01em] t-md leading-tight">未設定</p>
            )}
            <p className="mt-1.5 text-[13px] t-md">
              {hasBaton
                ? "書きおわったら、次の人にバトンを渡します。"
                : currentHolder
                  ? "バトンが戻ってくるのを待ちましょう。"
                  : "バトンを持つ人を決めましょう。"}
            </p>
          </div>
        </div>

        {hasBaton && (
          <Link href={`/groups/${groupId}/new`} className="btn btn-primary btn-sm shrink-0 hidden sm:inline-flex">
            書く
          </Link>
        )}
      </div>

      {hasBaton && (
        <Link href={`/groups/${groupId}/new`} className="btn btn-primary btn-block mt-4 sm:hidden">
          日記を書く
        </Link>
      )}
    </div>
  );
}
