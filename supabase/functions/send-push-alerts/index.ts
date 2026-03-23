// send-push-alerts — Supabase Edge Function
// Runs daily (via pg_cron or manual invocation) to send web push notifications
// for bills and credit cards due in 7, 3, 1, or 0 days.
//
// Required Supabase Edge Function secrets:
//   VAPID_PUBLIC_KEY   — your VAPID public key (base64url)
//   VAPID_PRIVATE_KEY  — your VAPID private key (base64url)
//   VAPID_SUBJECT      — mailto: or https: contact URI, e.g. mailto:admin@example.com

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@legacygrowth.solutions";

const ALERT_DAYS = [7, 3, 1, 0];

// ── helpers ──────────────────────────────────────────────────────────────────

function getDaysUntil(dayOfMonth: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  let target = new Date(year, month, dayOfMonth);
  if (target.getDate() < today) {
    // Due day already passed this month — look at next month
    target = new Date(year, month + 1, dayOfMonth);
  }
  const diff = Math.round((target.getTime() - new Date(year, month, today).getTime()) / 86_400_000);
  return diff;
}

function urgencyLabel(days: number): string {
  if (days === 0) return "Due TODAY";
  if (days === 1) return "Due TOMORROW";
  return `Due in ${days} days`;
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

    // Encrypt payload using Web Push encryption (RFC 8291)
    // For simplicity we use the raw JSON body approach supported by most push services
    // when combined with VAPID auth — the service worker decodes it.
    const body = JSON.stringify(payload);
    const enc = new TextEncoder();

    // Build ECDH shared secret for content encryption
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

    // HKDF for content encryption key and nonce (RFC 8291 / draft-ietf-webpush-encryption)
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const prk = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]);

    // auth_info = "Content-Encoding: auth\0"
    const authInfo = enc.encode("Content-Encoding: auth\0");
    const authContext = new Uint8Array([...authBytes, ...new Uint8Array(serverPublicKeyRaw), ...clientPublicKeyBytes]);

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

    // Pad and encrypt
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

  // Fetch all push subscriptions
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

    // Fetch user's bills
    const { data: bills } = await supabase
      .from("bills")
      .select("bill_name, due_day, amount")
      .eq("user_id", userId)
      .eq("is_paid_this_cycle", false);

    // Fetch user's credit cards
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("card_name, payment_due_day, minimum_payment")
      .eq("user_id", userId);

    const alerts: string[] = [];

    for (const bill of bills ?? []) {
      const days = getDaysUntil(bill.due_day);
      if (ALERT_DAYS.includes(days)) {
        alerts.push(`${bill.bill_name} — $${Number(bill.amount).toFixed(2)} — ${urgencyLabel(days)}`);
      }
    }

    for (const card of cards ?? []) {
      const days = getDaysUntil(card.payment_due_day);
      if (ALERT_DAYS.includes(days)) {
        alerts.push(`${card.card_name} payment — min $${Number(card.minimum_payment).toFixed(2)} — ${urgencyLabel(days)}`);
      }
    }

    if (alerts.length === 0) continue;

    const title = alerts.length === 1 ? "Payment Reminder" : `${alerts.length} Payments Due Soon`;
    const body = alerts.slice(0, 3).join("\n") + (alerts.length > 3 ? `\n+${alerts.length - 3} more` : "");

    const ok = await sendPush(sub.endpoint, sub.p256dh, sub.auth, {
      title,
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: "due-date-alert",
      url: "/",
    });

    if (ok) {
      sent++;
    } else {
      failed++;
      // Mark for cleanup if endpoint is gone (410 Gone)
      staleEndpoints.push(sub.endpoint);
    }
  }

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
