import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pencil, Bookmark, Sparkles, Film, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default async function Home() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unavailable
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
                <ArrowRight className="size-4" strokeWidth={1.8} />
              </Link>
            ) : (
              <>
                <Link href="/signup" className="btn btn-primary btn-lg">
                  アカウントを作る
                  <ArrowRight className="size-4" strokeWidth={1.8} />
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
            icon={Pencil}
          />
          <FeatureCard
            tag="Pass"
            title="バトン制"
            body="一人が書いたら次の人へ。順番が明確だから続く。"
            icon={Bookmark}
          />
          <FeatureCard
            tag="React"
            title="動くスタンプ"
            body="Lottie / APNG / WebP で返事する。言葉じゃない会話。"
            icon={Sparkles}
          />
          <FeatureCard
            tag="Animate"
            title="パラパラアニメ"
            body="コマ送り描画で、時間そのものを書き留める。"
            icon={Film}
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
    <div className="size-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink)" }}>
      <div className="size-2.5 rounded-[3px]" style={{ background: "var(--signal)" }} />
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  body,
  icon: Icon,
}: {
  tag: string;
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <div className="card p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div className="size-8 rounded-lg flex items-center justify-center t-md" style={{ background: "var(--paper-alt)" }}>
          <Icon className="size-4" strokeWidth={1.6} />
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
