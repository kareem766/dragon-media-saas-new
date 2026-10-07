-- Step 5 — Lock duplicate legacy organization/invite RPCs
-- Pre-check: no current src/ or api/ call site uses these public RPCs.
revoke execute on function public.create_organization_for_user(text, text, text) from public, anon, authenticated;
revoke execute on function public.accept_invite_code(text) from public, anon, authenticated;
