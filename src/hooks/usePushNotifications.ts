import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// VAPID public key — generate your own at https://web-push-codelab.glitch.me/
// Replace this with your actual VAPID public key after generating a key pair
// and setting VAPID_PRIVATE_KEY + VAPID_PUBLIC_KEY in Supabase Edge Function secrets
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? 
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  useEffect(() => {
    if (!isSupported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);
    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      setPermission("granted");
      setSubscribed(true);

      const subJson = sub.toJSON();
      // Save subscription to Supabase
      await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: (subJson.keys as any)?.p256dh ?? "",
        auth: (subJson.keys as any)?.auth ?? "",
        user_agent: navigator.userAgent,
      }, { onConflict: "endpoint" });
    } catch (err) {
      console.error("Push subscribe error:", err);
      setPermission(Notification.permission as PushPermission);
    } finally {
      setLoading(false);
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
        setSubscribed(false);
      }
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // Trigger a local test notification
  const testNotification = useCallback(async () => {
    if (!isSupported || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("Legacy Growth Solutions", {
      body: "🔔 Test alert — your notifications are working!",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: "test",
    });
  }, [isSupported]);

  return { permission, subscribed, loading, isSupported, subscribe, unsubscribe, testNotification };
}
