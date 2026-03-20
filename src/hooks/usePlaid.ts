import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

// ── Types ──────────────────────────────────────────────────────────────────
export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
}

export interface PlaidItem {
  id: string;
  institution_name: string;
  accounts: PlaidAccount[];
  last_synced: string;
}

// ── Fetch linked bank accounts ─────────────────────────────────────────────
export function usePlaidAccounts() {
  const { user } = useAuth();
  return useQuery<PlaidItem[]>({
    queryKey: ["plaid_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plaid_accounts")
        .select("id, institution_name, accounts, last_synced")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlaidItem[];
    },
  });
}

// ── Plaid Link hook ────────────────────────────────────────────────────────
export function usePlaidLinkFlow(onSuccess?: () => void) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid-create-link-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      const json = await res.json();
      if (json.link_token) setLinkToken(json.link_token);
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token, metadata) => {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid-exchange-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            public_token,
            institution_name: metadata.institution?.name ?? "Bank",
          }),
        }
      );
      queryClient.invalidateQueries({ queryKey: ["plaid_accounts"] });
      onSuccess?.();
    },
  });

  const openLink = useCallback(async () => {
    if (!linkToken) {
      await fetchLinkToken();
    } else {
      open();
    }
  }, [linkToken, fetchLinkToken, open]);

  // Auto-open once token is ready
  const openWhenReady = useCallback(async () => {
    await fetchLinkToken();
  }, [fetchLinkToken]);

  return { openLink: openWhenReady, ready: !loading, loading };
}

// ── Remove a linked bank ───────────────────────────────────────────────────
export function useRemovePlaidAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plaid_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plaid_accounts"] }),
  });
}
