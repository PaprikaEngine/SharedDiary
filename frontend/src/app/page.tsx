import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Notebook cover */}
      <div className="w-full max-w-sm paper-plain rounded-2xl p-8 relative tape">
        {/* Spine decoration */}
        <div className="absolute left-0 top-6 bottom-6 w-1 bg-moss/30 rounded-full" />

        <div className="pl-4 text-center">
          {/* Title like handwritten on cover */}
          <p className="text-xs tracking-[0.3em] text-ink-light/60 uppercase mb-4">
            Exchange Diary
          </p>
          <h1 className="font-bold text-3xl text-ink leading-tight mb-1" style={{ fontFamily: "var(--font-handwriting)" }}>
            SharedDiary
          </h1>
          <div className="w-16 h-px bg-coral/40 mx-auto my-4" />

          <p className="text-base text-ink-light leading-relaxed mb-2">
            懐かしい交換日記を、<br />もう一度。
          </p>
          <p className="text-sm text-ink-light/70 leading-relaxed mb-8">
            手書き・スタンプ・写真で<br />
            あの頃の楽しさをもう一度
          </p>

          <div className="space-y-3">
            {user ? (
              <Button asChild className="w-full h-11 rounded-lg text-base bg-moss hover:bg-moss-dark">
                <Link href="/groups">日記帳をひらく</Link>
              </Button>
            ) : (
              <>
                <Button asChild className="w-full h-11 rounded-lg text-base bg-moss hover:bg-moss-dark">
                  <Link href="/signup">はじめる</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full h-11 rounded-lg text-base text-ink-light hover:text-ink">
                  <Link href="/login">ログイン</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature hints below the "notebook" */}
      <div className="mt-10 max-w-xs text-center space-y-4 stagger-children">
        <Feature icon="✏️" text="キャンバスに手書き" />
        <Feature icon="🎀" text="バトンで交代して書く" />
        <Feature icon="🎉" text="動くスタンプでリアクション" />
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span className="text-xl shrink-0 w-8 text-center">{icon}</span>
      <span className="text-sm text-ink-light">{text}</span>
    </div>
  );
}
