"use client";

type User = {
  id: string;
  name: string;
  avatar_url: string | null;
} | null;

type Props = {
  currentHolder: User;
  hasBaton: boolean;
  groupId: string;
  batonPassedAt: string | null;
  deadlineDays: number;
};

function DeadlineBadge({ batonPassedAt, deadlineDays }: { batonPassedAt: string | null; deadlineDays: number }) {
  if (!batonPassedAt) return null;

  const deadline = new Date(batonPassedAt).getTime() + deadlineDays * 86400000;
  const now = Date.now();
  const daysLeft = Math.ceil((deadline - now) / 86400000);

  if (daysLeft < 0) {
    return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">期限超過</span>;
  }
  if (daysLeft === 0) {
    return <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">今日まで</span>;
  }
  if (daysLeft <= 1) {
    return <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">あと1日</span>;
  }
  return <span className="text-xs font-medium text-ink-light bg-cream-dark px-2 py-1 rounded-full">あと{daysLeft}日</span>;
}

export function BatonStatus({ currentHolder, hasBaton, batonPassedAt, deadlineDays }: Props) {
  return (
    <div
      className={`rounded-xl p-6 mb-8 ${
        hasBaton
          ? "bg-moss/10 border-2 border-moss"
          : "bg-white border border-cream-dark"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-4xl">🎀</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm text-ink-light">現在のバトン</p>
            <DeadlineBadge batonPassedAt={batonPassedAt} deadlineDays={deadlineDays} />
          </div>
          {currentHolder ? (
            <p className="text-lg font-medium text-ink">
              {hasBaton ? (
                <span className="text-moss">あなたの番です!</span>
              ) : (
                <span>{currentHolder.name}さんの番です</span>
              )}
            </p>
          ) : (
            <p className="text-lg font-medium text-ink-light">未設定</p>
          )}
        </div>
      </div>
      {hasBaton && (
        <p className="text-sm text-moss mt-3">
          日記を書いて、次の人にバトンを渡しましょう
        </p>
      )}
    </div>
  );
}
