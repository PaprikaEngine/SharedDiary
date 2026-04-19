"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush } from "@/lib/notifications";
import { Bell, Mail, Loader2 } from "lucide-react";
import { NOTIFICATIONS_ENABLED } from "@/lib/feature-flags";

export function NotificationSettings() {
  if (!NOTIFICATIONS_ENABLED) {
    return (
      <div className="card p-5">
        <p className="text-[14px] font-medium t-hi mb-1">通知は準備中です</p>
        <p className="text-[13px] t-md">
          メール通知・プッシュ通知は近日公開予定です。
        </p>
      </div>
    );
  }
  return <NotificationSettingsImpl />;
}

function NotificationSettingsImpl() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setPushSupported("serviceWorker" in navigator && "PushManager" in window);

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("email_enabled, push_enabled")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setEmailEnabled(data.email_enabled);
        setPushEnabled(data.push_enabled);
      }
      setLoading(false);
    };
    load();
  }, [supabase]);

  const updatePref = useCallback(async (field: string, value: boolean) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("notification_preferences")
      .upsert({ user_id: user.id, [field]: value }, { onConflict: "user_id" });
    setSaving(false);
  }, [supabase]);

  const toggleEmail = useCallback(async () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    await updatePref("email_enabled", next);
  }, [emailEnabled, updatePref]);

  const togglePush = useCallback(async () => {
    if (pushEnabled) {
      const reg = await registerServiceWorker();
      if (reg) await unsubscribeFromPush(reg);
      setPushEnabled(false);
      await updatePref("push_enabled", false);
    } else {
      const reg = await registerServiceWorker();
      if (!reg) return;
      const subscription = await subscribeToPush(reg);
      if (!subscription) return;
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setPushEnabled(true);
    }
  }, [pushEnabled, updatePref]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-ink-light/40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Email */}
      <button
        type="button"
        onClick={toggleEmail}
        disabled={saving}
        className="w-full flex items-center gap-3 p-4 paper-plain rounded-xl text-left transition-colors hover:bg-cream-dark/20"
      >
        <Mail className="size-5 text-ink-light shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">メール通知</p>
          <p className="text-xs text-ink-light/60">バトンが届いたらメールでお知らせ</p>
        </div>
        <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${emailEnabled ? "bg-moss justify-end" : "bg-cream-dark justify-start"}`}>
          <div className="size-5 rounded-full bg-white shadow-sm" />
        </div>
      </button>

      {/* Push */}
      {pushSupported && (
        <button
          type="button"
          onClick={togglePush}
          disabled={saving}
          className="w-full flex items-center gap-3 p-4 paper-plain rounded-xl text-left transition-colors hover:bg-cream-dark/20"
        >
          <Bell className="size-5 text-ink-light shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">プッシュ通知</p>
            <p className="text-xs text-ink-light/60">ブラウザ通知でリアルタイムにお知らせ</p>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${pushEnabled ? "bg-moss justify-end" : "bg-cream-dark justify-start"}`}>
            <div className="size-5 rounded-full bg-white shadow-sm" />
          </div>
        </button>
      )}
    </div>
  );
}
