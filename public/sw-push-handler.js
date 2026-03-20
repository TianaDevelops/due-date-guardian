// Service Worker Push Handler
// This file is injected into the Vite PWA service worker via importScripts or
// handled by the VitePWA injectManifest strategy.
// For now it registers a push event listener that shows notifications.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Due Date Guardian", body: event.data.text() };
  }

  const options = {
    body: data.body ?? "You have an upcoming payment due.",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag: data.tag ?? "ddg-alert",
    requireInteraction: data.urgent ?? false,
    data: { url: data.url ?? "/" },
    actions: [
      { action: "view", title: "View Dashboard" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title ?? "Due Date Guardian", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
