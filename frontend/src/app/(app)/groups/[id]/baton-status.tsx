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
};

export function BatonStatus({ currentHolder, hasBaton }: Props) {
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
        <div>
          <p className="text-sm text-ink-light mb-1">現在のバトン</p>
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
