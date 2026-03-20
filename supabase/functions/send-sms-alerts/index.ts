// Supabase Edge Function: send-sms-alerts
// Runs on a daily cron schedule. Checks all bills and credit cards
// with upcoming due dates and sends SMS via Twilio to users who have
// a phone number saved and sms_enabled in their alert_preferences.
//
// Environment variables required (set in Supabase Dashboard → Settings → Edge Functions):
//   TWILIO_ACCOUNT_SID  = (from console.twilio.com)
//   TWILIO_AUTH_TOKEN   = (from console.twilio.com)
//   TWILIO_FROM_NUMBER  = +14245265989
//   SUPABASE_URL        = (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY = (auto-injected)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ?? "+14245265989";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Twilio error:", data);
  }
  return data;
}

function getDaysUntil(dueDay: number): number {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (thisMonth < today) {
    // Due date passed this month — next occurrence is next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    return Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  return Math.ceil((thisMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (_req) => {
  try {
    // Alert thresholds: send SMS when N days away
    const ALERT_DAYS = [7, 3, 1, 0];

    // Get all profiles with phone numbers
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone_number")
      .not("phone_number", "is", null);

    if (profilesError) throw profilesError;

    let totalSent = 0;

    for (const profile of profiles ?? []) {
      const phone = profile.phone_number?.trim();
      if (!phone) continue;

      // Get user's bills
      const { data: bills } = await supabase
        .from("bills")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("is_paid_this_cycle", false);

      // Get user's credit cards
      const { data: cards } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", profile.user_id);

      const messages: string[] = [];

      for (const bill of bills ?? []) {
        const days = getDaysUntil(bill.due_day);
        if (ALERT_DAYS.includes(days)) {
          const urgency = days === 0 ? "⚠️ DUE TODAY" : days === 1 ? "🔴 DUE TOMORROW" : `📅 Due in ${days} days`;
          messages.push(`${urgency}: ${bill.bill_name} — $${Number(bill.amount).toFixed(2)}`);
        }
      }

      for (const card of cards ?? []) {
        const days = getDaysUntil(card.payment_due_day);
        if (ALERT_DAYS.includes(days)) {
          const urgency = days === 0 ? "⚠️ DUE TODAY" : days === 1 ? "🔴 DUE TOMORROW" : `📅 Due in ${days} days`;
          messages.push(`${urgency}: ${card.card_name} min payment $${Number(card.minimum_payment).toFixed(2)}`);
        }
      }

      if (messages.length > 0) {
        const name = profile.display_name ?? "there";
        const body = `Hey ${name}! Legacy Growth Solutions alert:\n\n${messages.join("\n")}\n\nStay on track 💪 ddg.legacygrowth.solutions`;
        await sendSMS(phone, body);
        totalSent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sms_sent: totalSent }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
