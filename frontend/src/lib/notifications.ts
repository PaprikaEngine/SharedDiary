export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.error("SW registration failed:", err);
    return null;
  }
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) { console.warn("VAPID public key not configured"); return null; }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });
  } catch (err) {
    console.error("Push subscription failed:", err);
    return null;
  }
}

export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) return await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

export async function triggerBatonNotification(
  groupId: string,
  nextHolderId: string,
): Promise<void> {
  try {
    await fetch("/api/notifications/baton-pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, nextHolderId }),
    });
  } catch {
    // Fire-and-forget — don't block the user on notification failure
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
