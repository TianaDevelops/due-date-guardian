// Supabase Edge Function: plaid-create-link-token
// Creates a Plaid Link token for the authenticated user.
//
// Environment variables required:
//   PLAID_CLIENT_ID     = your Plaid client_id
//   PLAID_SECRET        = your Plaid sandbox/production secret
//   PLAID_ENV           = sandbox | production
//   SUPABASE_URL        = (auto-injected)
//   SUPABASE_ANON_KEY   = (auto-injected)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID")!;
const PLAID_SECRET = Deno.env.get("PLAID_SECRET")!;
const PLAID_ENV = Deno.env.get("PLAID_ENV") ?? "sandbox";
const PLAID_BASE = `https://${PLAID_ENV}.plaid.com`;

Deno.serve(async (req) => {
  // Verify user is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const res = await fetch(`${PLAID_BASE}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: "Legacy Growth Solutions — Due Date Guardian",
        country_codes: ["US"],
        language: "en",
        user: { client_user_id: user.id },
        products: ["transactions", "auth"],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Plaid error:", data);
      return new Response(JSON.stringify({ error: data.error_message ?? "Plaid error" }), { status: 500 });
    }

    return new Response(JSON.stringify({ link_token: data.link_token }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
