"use client";

import { useState, useEffect } from "react";

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setSubscribed(!!sub);
        });
      });
    }
  }, []);

  useEffect(() => {
    if (supported) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, [supported]);

  const subscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setSubscribed(true);
    } catch {
      // User denied permission or other error
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await fetch("/api/notifications/subscribe", { method: "DELETE" });
      setSubscribed(false);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  if (!supported) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        subscribed
          ? "bg-moss/10 text-moss border border-moss/30"
          : "bg-white text-ink-light border border-cream-dark hover:border-moss"
      } disabled:opacity-50`}
    >
      <span>{subscribed ? "🔔" : "🔕"}</span>
      {loading ? "..." : subscribed ? "通知ON" : "通知OFF"}
    </button>
  );
}
