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
  if (!currentHolder) return null;

  return (
    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${hasBaton ? "bg-moss/8 border border-moss/20" : "bg-cream-dark/40"}`}>
      <span className={`dot-nb shrink-0 ${hasBaton ? "dot-nb-signal pulse-signal" : "dot-nb-accent"}`} />
      <div className="flex-1 min-w-0">
        {hasBaton ? (
          <>
            <p className="text-sm font-semibold text-moss">あなたの番です!</p>
            <p className="text-xs text-ink-light/60">日記を書いてバトンを渡しましょう</p>
          </>
        ) : (
          <p className="text-sm text-ink-light">
            <span className="font-medium text-ink">{currentHolder.name}</span>さんの番です
          </p>
        )}
      </div>
      {hasBaton && (
        <Link
          href={`/groups/${groupId}/new`}
          className="shrink-0 text-xs font-medium text-white bg-moss hover:bg-moss-dark rounded-full px-3 py-1.5 transition-colors"
        >
          書く
        </Link>
      )}
    </div>
  );
}
