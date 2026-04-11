"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GatePage() {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "エラーが発生しました");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("エラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-cream">
      <div className="w-full max-w-xs paper-plain rounded-2xl p-8 relative tape">
        <div className="absolute left-0 top-6 bottom-6 w-1 bg-moss/30 rounded-full" />

        <div className="pl-4 text-center">
          <p className="text-xs tracking-[0.3em] text-ink-light/60 uppercase mb-3">
            Exchange Diary
          </p>
          <h1
            className="font-bold text-2xl text-ink leading-tight mb-1"
            style={{ fontFamily: "var(--font-handwriting)" }}
          >
            SharedDiary
          </h1>
          <div className="w-12 h-px bg-coral/40 mx-auto my-4" />

          <p className="text-sm text-ink-light leading-relaxed mb-6">
            まだ準備中です。<br />
            合言葉を知っている方だけ<br />
            お入りください。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="合言葉"
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-cream-dark bg-white/60 text-center text-sm text-ink placeholder:text-ink-light/40 focus:outline-none focus:border-moss/50 focus:ring-1 focus:ring-moss/20 transition-colors"
            />

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !passphrase}
              className="w-full h-10 rounded-lg text-sm font-medium bg-moss hover:bg-moss-dark text-white transition-colors disabled:opacity-50"
            >
              {loading ? "確認中..." : "入る"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
