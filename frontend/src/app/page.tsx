import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pencil, Bookmark, Sparkles, ArrowRight } from "lucide-react";
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
      <header className="px-6 md:px-10 py-5 flex items-center justify-between animate-write-in">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-medium text-[14px] tracking-tight t-hi">SharedDiary</span>
          <span className="meta-sm ml-1">β</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/groups" className="btn-nb btn-nb-primary btn-nb-sm">
              開く
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-nb btn-nb-flat btn-nb-sm">
                ログイン
              </Link>
              <Link href="/signup" className="btn-nb btn-nb-primary btn-nb-sm">
                はじめる
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 px-6 md:px-10 flex flex-col">
        <div className="max-w-5xl mx-auto w-full pt-16 md:pt-24 pb-10 stagger-children">
          <div className="flex items-center gap-2 mb-6">
            <span className="dot-nb dot-nb-accent" />
            <span className="meta">Private exchange diary · invitation only</span>
          </div>

          <h1 className="text-[42px] md:text-[64px] leading-[1.04] font-medium tracking-[-0.025em] t-hi max-w-4xl">
            交換日記を、
            <br />
            ひとつのノートアプリで。
          </h1>

          <p className="mt-7 text-[16px] leading-[1.7] t-md max-w-xl">
            手書きキャンバス、写真、パラパラアニメ、動くスタンプ。
            バトン制で順番に書き、招待した仲間だけで読む、プライベートな日記帳。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {user ? (
              <Link href="/groups" className="btn-nb btn-nb-primary btn-nb-lg">
                日記帳を開く
                <ArrowRight className="size-4" strokeWidth={1.8} />
              </Link>
            ) : (
              <>
                <Link href="/signup" className="btn-nb btn-nb-primary btn-nb-lg">
                  はじめる
                  <ArrowRight className="size-4" strokeWidth={1.8} />
                </Link>
                <Link href="/login" className="btn-nb btn-nb-ghost btn-nb-lg">
                  ログイン
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature cards */}
        <div className="max-w-5xl mx-auto w-full pb-20 grid grid-cols-1 md:grid-cols-3 gap-3 stagger-children">
          <FeatureCard
            tag="Write"
            title="手書きキャンバス"
            body="ペン・消しゴム・テキスト。ノートアプリのような静かな書き心地。"
            icon={Pencil}
          />
          <FeatureCard
            tag="Pass"
            title="バトン制"
            body="書き終えたら次の人へ。順番が見えるから、続いていく。"
            icon={Bookmark}
          />
          <FeatureCard
            tag="React"
            title="動くスタンプ"
            body="Lottie / APNG / WebP で返事する。言葉じゃない会話。"
            icon={Sparkles}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t rule-hair px-6 md:px-10 py-5 flex items-center justify-between t-lo">
        <span className="meta-sm">© 2026 SharedDiary</span>
        <span className="meta-sm">Private · Invitation only</span>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <div className="size-6 rounded-[7px] flex items-center justify-center" style={{ background: "var(--ink-core)" }}>
      <div className="size-2.5 rounded-[3px]" style={{ background: "var(--signal-amber)" }} />
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
    <div className="card-note p-5 flex flex-col gap-3 h-full">
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
