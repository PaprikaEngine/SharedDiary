// Service Worker for Web Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: data.url || "/" },
    };
    event.waitUntil(self.registration.showNotification(data.title || "交換日記", options));
  } catch {
    // Fallback for plain text payloads
    event.waitUntil(
      self.registration.showNotification("交換日記", { body: event.data.text() })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
