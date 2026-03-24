-- Migration: add last_payment_date to bills and credit_cards
-- This enables accurate overdue tracking across monthly cycles.

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS last_payment_date DATE;

ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS last_payment_date DATE;

-- Comment explaining the overdue logic:
-- A payment is considered overdue when:
--   1. today > due_day this month, AND
--   2. last_payment_date IS NULL OR last_payment_date < first day of current month
-- Days overdue = today - due_date_this_month
-- Bureau reporting risk triggers at 30 days overdue.
-- Alerts fire at: 1, 7, 14, and 25 days overdue.
