import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationSettings } from "@/components/notification-settings";

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm border-b border-cream-dark/50">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link href="/groups" className="text-ink-light hover:text-ink transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold text-ink">設定</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-ink-light mb-3">通知</h2>
          <NotificationSettings />
        </section>
      </main>
    </div>
  );
}
