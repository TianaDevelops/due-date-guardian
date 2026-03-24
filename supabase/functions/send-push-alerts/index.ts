// send-push-alerts — Supabase Edge Function
// Runs daily (via pg_cron) to send web push notifications for:
//   1. Upcoming due dates (7, 3, 1, 0 days before due)
//   2. Overdue payments (1, 7, 14, 25 days past due) — to prevent 30-day credit bureau reporting
//
// Required Supabase Edge Function secrets:
//   VAPID_PUBLIC_KEY   — your VAPID public key (base64url)
//   VAPID_PRIVATE_KEY  — your VAPID private key (base64url)
//   VAPID_SUBJECT      — mailto: or https: contact URI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@legacygrowth.solutions";

// Days BEFORE due date to alert
const UPCOMING_ALERT_DAYS = [7, 3, 1, 0];
// Days AFTER due date to alert (overdue)
const OVERDUE_ALERT_DAYS = [1, 7, 14, 25];

// ── helpers ──────────────────────────────────────────────────────────────────

function getDaysUntil(dayOfMonth: number): number {
  const now = new Date();
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  let target = new Date(year, month, dayOfMonth);
  if (target.getDate() < today) {
    target = new Date(year, month + 1, dayOfMonth);
  }
  return Math.round((target.getTime() - new Date(year, month, today).getTime()) / 86_400_000);
}

/**
 * Returns how many days overdue a payment is, or -1 if not overdue.
 * A payment is overdue if:
 *   - today > due_day this month, AND
 *   - last_payment_date is null OR last_payment_date is before the 1st of this month
 */
function getDaysOverdue(dueDay: number, lastPaymentDate: string | null): number {
  const now = new Date();
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (today <= dueDay) return -1; // Not yet past due this month

  // Check if paid this month
  if (lastPaymentDate) {
    const paid = new Date(lastPaymentDate);
    const firstOfMonth = new Date(year, month, 1);
    if (paid >= firstOfMonth) return -1; // Paid this month
  }

  const dueDate = new Date(year, month, dueDay);
  const todayDate = new Date(year, month, today);
  return Math.round((todayDate.getTime() - dueDate.getTime()) / 86_400_000);
}

function upcomingLabel(days: number): string {
  if (days === 0) return "Due TODAY";
  if (days === 1) return "Due TOMORROW";
  return `Due in ${days} days`;
}

function overdueLabel(days: number): string {
  if (days === 25) return `⚠️ URGENT: ${days} days overdue — 5 days until credit bureau reporting!`;
  if (days === 14) return `🚨 ${days} days overdue — pay now to protect your credit score`;
  if (days === 7) return `❗ ${days} days overdue — payment missed`;
  return `${days} day(s) overdue — payment missed`;
}

// ── VAPID signing ─────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(sig)}`;
}

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object
): Promise<boolean> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await buildVapidJwt(audience);

    const body = JSON.stringify(payload);
    const enc = new TextEncoder();

    const serverKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );

    const clientPublicKeyBytes = base64UrlDecode(p256dh);
    const clientPublicKey = await crypto.subtle.importKey(
      "raw",
      clientPublicKeyBytes,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    const sharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      serverKeyPair.privateKey,
      256
    );

    const authBytes = base64UrlDecode(auth);
    const serverPublicKeyRaw = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const prk = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]);

    const authInfo = enc.encode("Content-Encoding: auth\0");
    const ikm = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo },
      prk,
      256
    );

    const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
    const cekInfo = enc.encode("Content-Encoding: aesgcm\0");
    const nonceInfo = enc.encode("Content-Encoding: nonce\0");

    const cekBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo }, ikmKey, 128);
    const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, ikmKey, 96);

    const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);

    const plaintext = enc.encode(body);
    const padded = new Uint8Array(2 + plaintext.length);
    padded.set(plaintext, 2);

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits },
      cek,
      padded
    );

    const serverPublicKeyB64 = base64UrlEncode(serverPublicKeyRaw);
    const saltB64 = base64UrlEncode(salt.buffer);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        Encryption: `salt=${saltB64}`,
        "Crypto-Key": `dh=${serverPublicKeyB64};p256ecdsa=${VAPID_PUBLIC_KEY}`,
        TTL: "86400",
      },
      body: ciphertext,
    });

    return res.ok || res.status === 201;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (subsError || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subs) {
    const userId = sub.user_id;

    const { data: bills } = await supabase
      .from("bills")
      .select("bill_name, due_day, amount, is_paid_this_cycle, last_payment_date")
      .eq("user_id", userId);

    const { data: cards } = await supabase
      .from("credit_cards")
      .select("card_name, payment_due_day, minimum_payment, last_payment_date")
      .eq("user_id", userId);

    const upcomingAlerts: string[] = [];
    const overdueAlerts: string[] = [];

    // ── Bills ──
    for (const bill of bills ?? []) {
      if (!bill.is_paid_this_cycle) {
        // Upcoming alerts
        const daysUntil = getDaysUntil(bill.due_day);
        if (UPCOMING_ALERT_DAYS.includes(daysUntil)) {
          upcomingAlerts.push(`${bill.bill_name} — $${Number(bill.amount).toFixed(2)} — ${upcomingLabel(daysUntil)}`);
        }
        // Overdue alerts
        const daysOver = getDaysOverdue(bill.due_day, bill.last_payment_date);
        if (daysOver > 0 && OVERDUE_ALERT_DAYS.includes(daysOver)) {
          overdueAlerts.push(`${bill.bill_name} — $${Number(bill.amount).toFixed(2)} — ${overdueLabel(daysOver)}`);
        }
      }
    }

    // ── Credit Cards ──
    for (const card of cards ?? []) {
      // Upcoming alerts
      const daysUntil = getDaysUntil(card.payment_due_day);
      if (UPCOMING_ALERT_DAYS.includes(daysUntil)) {
        upcomingAlerts.push(`${card.card_name} — min $${Number(card.minimum_payment).toFixed(2)} — ${upcomingLabel(daysUntil)}`);
      }
      // Overdue alerts
      const daysOver = getDaysOverdue(card.payment_due_day, card.last_payment_date);
      if (daysOver > 0 && OVERDUE_ALERT_DAYS.includes(daysOver)) {
        overdueAlerts.push(`${card.card_name} — min $${Number(card.minimum_payment).toFixed(2)} — ${overdueLabel(daysOver)}`);
      }
    }

    // Send overdue alerts first (higher priority), then upcoming
    if (overdueAlerts.length > 0) {
      const isUrgent = overdueAlerts.some(a => a.includes("25 days"));
      const title = isUrgent
        ? "🚨 URGENT: Credit Bureau Reporting Risk!"
        : `⚠️ Missed Payment${overdueAlerts.length > 1 ? "s" : ""} — Action Required`;
      const body = overdueAlerts.slice(0, 3).join("\n") + (overdueAlerts.length > 3 ? `\n+${overdueAlerts.length - 3} more` : "");

      const ok = await sendPush(sub.endpoint, sub.p256dh, sub.auth, {
        title,
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "overdue-alert",
        url: "/",
        requireInteraction: isUrgent, // keeps notification visible until dismissed for 25-day alerts
      });
      if (ok) sent++; else { failed++; staleEndpoints.push(sub.endpoint); }
    }

    if (upcomingAlerts.length > 0) {
      const title = upcomingAlerts.length === 1 ? "Payment Reminder" : `${upcomingAlerts.length} Payments Due Soon`;
      const body = upcomingAlerts.slice(0, 3).join("\n") + (upcomingAlerts.length > 3 ? `\n+${upcomingAlerts.length - 3} more` : "");

      const ok = await sendPush(sub.endpoint, sub.p256dh, sub.auth, {
        title,
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "due-date-alert",
        url: "/",
      });
      if (ok) sent++; else { failed++; staleEndpoints.push(sub.endpoint); }
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
