-- Step 2 — Remove unsafe Ryan credit purchase overload
-- Pre-check completed: no src/ or api/ usage of the (p_messages, p_amount) overload.
-- IF EXISTS keeps this migration idempotent because Production may already have
-- removed the legacy overload during an earlier hardening deployment.
drop function if exists public.create_ryan_credit_purchase(integer, numeric, text, text, date, text, jsonb);
