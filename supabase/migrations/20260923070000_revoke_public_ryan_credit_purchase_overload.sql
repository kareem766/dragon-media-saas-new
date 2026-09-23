-- Keep the Ryan credit purchase package-based RPC callable only by signed-in users.
-- PUBLIC grants are inherited by anon unless explicitly revoked.
REVOKE EXECUTE ON FUNCTION public.create_ryan_credit_purchase(uuid, text, text, date, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_ryan_credit_purchase(uuid, text, text, date, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_ryan_credit_purchase(uuid, text, text, date, text, jsonb) TO authenticated;
