-- Step 2 — Remove unsafe Ryan credit purchase overload
-- Pre-check completed: no src/ or api/ usage of the (p_messages, p_amount) overload.
drop function public.create_ryan_credit_purchase(integer, numeric, text, text, date, text, jsonb);
