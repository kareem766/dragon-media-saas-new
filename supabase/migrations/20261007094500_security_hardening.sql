-- Dragon Media security hardening — 2026-10-07
-- Step 1 — Lock trigger functions
revoke execute on function public.ensure_default_pipeline_stages() from public, anon, authenticated;
revoke execute on function public.notify_company_on_support_ticket_reply() from public, anon, authenticated;
revoke execute on function public.ensure_ryan_agent_for_organization() from public, anon, authenticated;
