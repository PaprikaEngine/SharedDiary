import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unavailable — show logged-out state
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Top nav */}
      <header className="px-6 md:px-10 py-5 flex items-center justify-between reveal reveal-1">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-medium text-[14px] tracking-tight t-hi">SharedDiary</span>
          <span className="meta-sm ml-1">v0.1</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/groups" className="btn btn-primary btn-sm">
              開く
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-flat btn-sm">
                ログイン
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                はじめる
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 px-6 md:px-10 flex flex-col">
        <div className="max-w-6xl mx-auto w-full pt-20 md:pt-28 pb-10">
          <div className="flex items-center gap-2 mb-6 reveal reveal-2">
            <span className="dot dot-accent" />
            <span className="meta">A private note-taking diary, for two or more</span>
          </div>

          <h1 className="text-[44px] md:text-[72px] leading-[1.02] font-medium tracking-[-0.025em] t-hi max-w-4xl reveal reveal-2">
            交換日記を、
            <br />
            ひとつのノートアプリで。
          </h1>

          <p className="mt-7 text-[17px] leading-[1.7] t-md max-w-xl reveal reveal-3">
            手書きのキャンバス、写真、パラパラアニメ、動くスタンプ。
            バトン制で順番に書き、招待した仲間だけで読む、プライベートな日記帳。
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3 reveal reveal-4">
            {user ? (
              <Link href="/groups" className="btn btn-primary btn-lg">
                日記帳を開く
                <ArrowRight />
              </Link>
            ) : (
              <>
                <Link href="/signup" className="btn btn-primary btn-lg">
                  アカウントを作る
                  <ArrowRight />
                </Link>
                <Link href="/login" className="btn btn-ghost btn-lg">
                  ログイン
                </Link>
              </>
            )}
            <span className="meta ml-1 hidden sm:inline-flex items-center gap-1.5">
              <span className="kbd">⌘</span>
              <span className="kbd">N</span>
              <span>で新規作成</span>
            </span>
          </div>
        </div>

        {/* Feature grid — 4 app-like cards */}
        <div className="max-w-6xl mx-auto w-full pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 reveal reveal-5">
          <FeatureCard
            tag="Compose"
            title="手書きキャンバス"
            body="ペン・消しゴム・テキストボックスで、ノートアプリのように書ける。"
            icon={<IconPen />}
          />
          <FeatureCard
            tag="Pass"
            title="バトン制"
            body="一人が書いたら次の人へ。順番が明確だから続く。"
            icon={<IconBaton />}
          />
          <FeatureCard
            tag="React"
            title="動くスタンプ"
            body="Lottie / APNG / WebP で返事する。言葉じゃない会話。"
            icon={<IconSticker />}
          />
          <FeatureCard
            tag="Animate"
            title="パラパラアニメ"
            body="コマ送り描画で、時間そのものを書き留める。"
            icon={<IconFlip />}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t rule-hair px-6 md:px-10 py-5 flex items-center justify-between t-lo">
        <span className="meta-sm">Private · Invitation only</span>
        <span className="meta-sm">© 2026 SharedDiary</span>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <div className="w-6 h-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink)" }}>
      <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--signal)" }} />
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  body,
  icon,
}: {
  tag: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center t-hi" style={{ background: "var(--paper-alt)" }}>
          {icon}
        </div>
        <span className="meta-sm">{tag}</span>
      </div>
      <div>
        <h3 className="text-[15px] font-medium tracking-tight t-hi mb-1.5">{title}</h3>
        <p className="text-[13px] leading-[1.55] t-md">{body}</p>
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M10.3 1.7L13.3 4.7L4.5 13.5L1.5 13.5L1.5 10.5L10.3 1.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.5 3.5L11.5 6.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function IconBaton() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="3.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7.5H9.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function IconSticker() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M2 2H9L13 6V13H2V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 2V6H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconFlip() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <rect x="2" y="4" width="8" height="9" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 2L13 2L13 11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
