

# 💳 NeverLate — Credit Card & Bill Payment Tracker

A clean, minimal personal finance app that keeps you on top of every payment deadline with escalating alerts so you're never reported late.

---

## 1. Dashboard (Home Screen)
- **At-a-glance overview** showing:
  - Total bills due this month
  - Next upcoming payment (with countdown)
  - Total credit card balances
  - Monthly spending summary
- **Alert banner** at the top for any overdue or upcoming payments
- **Quick-add buttons** for new cards and bills
- Color-coded urgency indicators (green → yellow → orange → red)

## 2. Credit Card Management
- Add/edit/delete credit cards with full details:
  - Card name & issuer
  - Statement closing date (monthly recurring)
  - Payment due date (monthly recurring)
  - Credit limit & current balance
  - Minimum payment amount
  - APR
  - Auto-calculated utilization percentage
- Card detail view showing payment history and upcoming dates
- Visual utilization bar per card (green < 30%, yellow < 50%, red > 50%)

## 3. Bill Management
- Add/edit/delete recurring bills (rent, utilities, subscriptions, etc.)
- Track: bill name, amount, due date, frequency (monthly/weekly/quarterly)
- Mark bills as paid each cycle
- Upcoming bills timeline view

## 4. Smart Alert System (In-App + SMS)
- **Pre-due date alerts**: 7 days, 3 days, 1 day before, and day-of reminders
- **Escalating late-payment alerts**:
  - 5 days late — gentle reminder
  - 15 days late — urgent warning
  - 29 days late — critical "PAY NOW!" alert (before 30-day late reporting)
- In-app notification center with alert history
- SMS notifications via Twilio for all alert tiers
- Users can customize which alerts they want for each card/bill

## 5. Calendar View
- Monthly calendar showing all due dates and statement dates
- Color-coded dots for credit cards vs. bills
- Tap a date to see all items due that day

## 6. User Accounts & Authentication
- Email/password signup and login
- Secure cloud storage — access your data from any device
- User profile settings (name, phone number for SMS)

## 7. Settings
- Manage notification preferences (toggle in-app/SMS per alert type)
- Phone number for SMS alerts
- Dark mode toggle (future enhancement)

---

## Technical Approach
- **Backend**: Supabase (Lovable Cloud) for database, auth, and edge functions
- **SMS**: Twilio integration via Supabase edge function
- **Scheduled alerts**: Supabase cron jobs to check for upcoming/overdue dates and trigger notifications
- **Design**: Clean, minimal UI with clear typography and subtle color-coded urgency indicators

