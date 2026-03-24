// Supabase Edge Function: send-sms-alerts
// Runs on a daily cron schedule. Sends SMS via Twilio for:
//   1. Upcoming due dates (7, 3, 1, 0 days before due)
//   2. Overdue payments (1, 7, 14, 25 days past due) — to prevent 30-day credit bureau reporting
//
// Environment variables required:
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

// Alert thresholds
const UPCOMING_ALERT_DAYS = [7, 3, 1, 0];
const OVERDUE_ALERT_DAYS = [1, 7, 14, 25];

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
  if (!res.ok) console.error("Twilio error:", data);
  return data;
}

function getDaysUntil(dueDay: number): number {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (thisMonth.getDate() < today.getDate()) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    return Math.ceil((nextMonth.getTime() - today.getTime()) / 86_400_000);
  }
  return Math.ceil((thisMonth.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Returns days overdue, or -1 if not overdue.
 * Overdue = today > due_day this month AND not paid this month.
 */
function getDaysOverdue(dueDay: number, lastPaymentDate: string | null): number {
  const now = new Date();
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (today <= dueDay) return -1;

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
  if (days === 0) return "⚠️ DUE TODAY";
  if (days === 1) return "🔴 DUE TOMORROW";
  return `📅 Due in ${days} days`;
}

function overdueLabel(days: number): string {
  if (days === 25) return `🚨 URGENT — ${days} days overdue! Only 5 days before credit bureau reporting!`;
  if (days === 14) return `🚨 ${days} days overdue — pay NOW to protect your credit score`;
  if (days === 7) return `❗ ${days} days overdue — payment missed`;
  return `❗ ${days} day(s) overdue — payment missed`;
}

Deno.serve(async (_req) => {
  try {
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
        .select("bill_name, due_day, amount, is_paid_this_cycle, last_payment_date")
        .eq("user_id", profile.user_id);

      // Get user's credit cards
      const { data: cards } = await supabase
        .from("credit_cards")
        .select("card_name, payment_due_day, minimum_payment, last_payment_date")
        .eq("user_id", profile.user_id);

      const overdueMessages: string[] = [];
      const upcomingMessages: string[] = [];

      // ── Bills ──
      for (const bill of bills ?? []) {
        if (!bill.is_paid_this_cycle) {
          const daysUntil = getDaysUntil(bill.due_day);
          if (UPCOMING_ALERT_DAYS.includes(daysUntil)) {
            upcomingMessages.push(`${upcomingLabel(daysUntil)}: ${bill.bill_name} — $${Number(bill.amount).toFixed(2)}`);
          }
          const daysOver = getDaysOverdue(bill.due_day, bill.last_payment_date);
          if (daysOver > 0 && OVERDUE_ALERT_DAYS.includes(daysOver)) {
            overdueMessages.push(`${overdueLabel(daysOver)}: ${bill.bill_name} — $${Number(bill.amount).toFixed(2)}`);
          }
        }
      }

      // ── Credit Cards ──
      for (const card of cards ?? []) {
        const daysUntil = getDaysUntil(card.payment_due_day);
        if (UPCOMING_ALERT_DAYS.includes(daysUntil)) {
          upcomingMessages.push(`${upcomingLabel(daysUntil)}: ${card.card_name} min $${Number(card.minimum_payment).toFixed(2)}`);
        }
        const daysOver = getDaysOverdue(card.payment_due_day, card.last_payment_date);
        if (daysOver > 0 && OVERDUE_ALERT_DAYS.includes(daysOver)) {
          overdueMessages.push(`${overdueLabel(daysOver)}: ${card.card_name} min $${Number(card.minimum_payment).toFixed(2)}`);
        }
      }

      const name = profile.display_name ?? "there";

      // Send overdue SMS first (separate message, higher urgency)
      if (overdueMessages.length > 0) {
        const isUrgent = overdueMessages.some(m => m.includes("25 days"));
        const header = isUrgent
          ? `🚨 CREDIT ALERT for ${name}!`
          : `⚠️ Missed Payment Alert for ${name}`;
        const footer = isUrgent
          ? `\n\n⏰ Pay NOW to avoid 30-day late mark on your credit report!\nddg.legacygrowth.solutions`
          : `\n\nPay ASAP to protect your credit score.\nddg.legacygrowth.solutions`;
        await sendSMS(phone, `${header}\n\n${overdueMessages.join("\n")}${footer}`);
        totalSent++;
      }

      // Send upcoming reminders
      if (upcomingMessages.length > 0) {
        const body = `Hey ${name}! Legacy Growth Solutions payment reminder:\n\n${upcomingMessages.join("\n")}\n\nStay on track 💪\nddg.legacygrowth.solutions`;
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
