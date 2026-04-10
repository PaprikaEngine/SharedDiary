export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <main className="flex flex-col items-center text-center max-w-lg">
        <h1 className="text-4xl font-bold text-moss mb-4">
          SharedDiary
        </h1>
        <p className="text-xl text-ink-light mb-8">
          懐かしい交換日記を、もう一度。
        </p>
        <p className="text-ink-light mb-12 leading-relaxed">
          テキストだけでなく、画像・動画・パラパラアニメ・動くスタンプで
          「あの頃の創作の楽しさ」をデジタルで再現。
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button className="bg-moss text-cream px-6 py-3 rounded-lg font-medium hover:bg-moss-dark transition-colors">
            はじめる
          </button>
          <button className="border-2 border-moss text-moss px-6 py-3 rounded-lg font-medium hover:bg-moss hover:text-cream transition-colors">
            ログイン
          </button>
        </div>
      </main>
    </div>
  );
}
