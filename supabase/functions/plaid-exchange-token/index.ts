// Supabase Edge Function: plaid-exchange-token
// Exchanges a Plaid public_token for an access_token and fetches account balances.
// Stores the access_token and balances in the plaid_accounts table.
//
// Environment variables required:
//   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID")!;
const PLAID_SECRET = Deno.env.get("PLAID_SECRET")!;
const PLAID_ENV = Deno.env.get("PLAID_ENV") ?? "sandbox";
const PLAID_BASE = `https://${PLAID_ENV}.plaid.com`;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const { public_token, institution_name } = body;

  try {
    // Exchange public token for access token
    const exchangeRes = await fetch(`${PLAID_BASE}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });
    const exchangeData = await exchangeRes.json();
    if (!exchangeRes.ok) {
      return new Response(JSON.stringify({ error: exchangeData.error_message }), { status: 500 });
    }

    const access_token = exchangeData.access_token;
    const item_id = exchangeData.item_id;

    // Fetch account balances
    const balanceRes = await fetch(`${PLAID_BASE}/accounts/balance/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token,
      }),
    });
    const balanceData = await balanceRes.json();

    // Store in plaid_accounts table
    const { error: upsertError } = await serviceSupabase
      .from("plaid_accounts")
      .upsert({
        user_id: user.id,
        item_id,
        access_token,
        institution_name: institution_name ?? "Bank",
        accounts: balanceData.accounts ?? [],
        last_synced: new Date().toISOString(),
      }, { onConflict: "item_id" });

    if (upsertError) {
      console.error("DB error:", upsertError);
    }

    return new Response(
      JSON.stringify({ success: true, accounts: balanceData.accounts ?? [] }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
