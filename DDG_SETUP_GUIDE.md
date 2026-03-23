# Due Date Guardian — Setup & Configuration Guide
**Legacy Growth Solutions**

---

## What Was Added in This Update

| Feature | Status |
|---|---|
| Google Sign-In (OAuth) | ✅ Live |
| CSV Import for Bills | ✅ Live |
| CSV Import for Credit Cards | ✅ Live (new) |
| Push Notification frontend subscription | ✅ Live |
| Push Notification server-side sender | ✅ Code ready — needs deploy + VAPID keys |
| SMS Alerts via Twilio | ✅ Code ready — needs deploy + Twilio secrets + cron |
| Plaid Bank Sync | ✅ Code ready — needs Plaid account setup |

---

## 1. CSV Import

Both the **Bills** page and the **Credit Cards** page now have an **Import CSV** button.
Each dialog includes a **Download sample CSV template** link so you can see the exact format.

### Bills CSV columns
`bill_name, amount, due_day, frequency`
- `frequency` accepts: `monthly`, `weekly`, `quarterly` (defaults to `monthly`)

### Credit Cards CSV columns
`card_name, issuer, statement_closing_day, payment_due_day, credit_limit, current_balance, minimum_payment, apr`
- All numeric fields default to `0` if blank

---

## 2. Push Notifications (Server-Side)

The app can already **subscribe** devices. To actually **deliver** due-date alerts server-side, complete these steps:

### Step 2a — Generate VAPID Keys
1. Go to [https://web-push-codelab.glitch.me/](https://web-push-codelab.glitch.me/)
2. Click **Generate** — copy both keys

### Step 2b — Add to Netlify
In Netlify → Site → Environment Variables, add:
```
VITE_VAPID_PUBLIC_KEY = <your public key>
```
Then trigger a redeploy.

### Step 2c — Add to Supabase Edge Function Secrets
Go to: **Supabase Dashboard → Settings → Edge Functions → Secrets**
Add:
```
VAPID_PUBLIC_KEY   = <your public key>
VAPID_PRIVATE_KEY  = <your private key>
VAPID_SUBJECT      = mailto:admin@legacygrowth.solutions
```

### Step 2d — Deploy the Edge Function
```bash
supabase login
supabase link --project-ref hojdkhzucunymwgzgazs
supabase functions deploy send-push-alerts
```

### Step 2e — Schedule Daily Push Alerts (pg_cron)
In Supabase Dashboard → Database → Extensions, enable **pg_cron**.

Then run this SQL (replace `YOUR_SERVICE_ROLE_KEY`):
```sql
SELECT cron.schedule(
  'daily-push-alerts',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hojdkhzucunymwgzgazs.supabase.co/functions/v1/send-push-alerts',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## 3. SMS Alerts via Twilio

### Step 3a — Get Twilio Credentials
1. Sign up at [console.twilio.com](https://console.twilio.com)
2. Your number is already set: **(424) 526-5989**
3. Copy your **Account SID** and **Auth Token**

### Step 3b — Register for A2P 10DLC (prevents spam filtering)
In Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC
Register your brand and campaign. This is required for US SMS delivery.

### Step 3c — Add Supabase Secrets
Go to: **Supabase Dashboard → Settings → Edge Functions → Secrets**
Add:
```
TWILIO_ACCOUNT_SID   = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN    = your_auth_token
TWILIO_FROM_NUMBER   = +14245265989
```

### Step 3d — Deploy the SMS Edge Function
```bash
supabase functions deploy send-sms-alerts
```

### Step 3e — Schedule Daily SMS (pg_cron)
```sql
SELECT cron.schedule(
  'daily-sms-alerts',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hojdkhzucunymwgzgazs.supabase.co/functions/v1/send-sms-alerts',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

> **Note:** Users must enter their phone number in **Settings → SMS Alerts** to receive texts.

---

## 4. Plaid Bank Sync

### Step 4a — Create a Plaid Account
1. Go to [dashboard.plaid.com](https://dashboard.plaid.com) and create a free account
2. Create a new app/project
3. Copy your **Client ID** and **Sandbox Secret**

### Step 4b — Add Supabase Secrets
```
PLAID_CLIENT_ID  = your_client_id
PLAID_SECRET     = your_sandbox_secret
PLAID_ENV        = sandbox
```
(Change `PLAID_ENV` to `production` when ready to go live)

### Step 4c — Add Redirect URI in Plaid Dashboard
In Plaid Dashboard → API → Allowed redirect URIs, add:
```
https://ddg.legacygrowth.solutions
```

### Step 4d — Deploy Plaid Edge Functions
```bash
supabase functions deploy plaid-create-link-token
supabase functions deploy plaid-exchange-token
```

### Step 4e — Run the Database Migration
In Supabase Dashboard → SQL Editor, run the contents of:
`supabase/migrations/20260319000001_plaid_and_push.sql`

### Testing Plaid in Sandbox Mode
- Username: `user_good`
- Password: `pass_good`
- This simulates a real bank with fake data

---

## 5. Supabase Project Reference

| Setting | Value |
|---|---|
| Project ID | `hojdkhzucunymwgzgazs` |
| Site URL | `https://ddg.legacygrowth.solutions` |
| Auth Callback | `https://hojdkhzucunymwgzgazs.supabase.co/auth/v1/callback` |

---

## 6. Google OAuth (Already Configured)

| Setting | Value |
|---|---|
| Client ID | `9488326897-qa683v0lb1mcip87o6lidap5t23b220j.apps.googleusercontent.com` |
| Supabase Provider | Enabled ✅ |
| Redirect URIs | Both registered in Google Cloud Console ✅ |
