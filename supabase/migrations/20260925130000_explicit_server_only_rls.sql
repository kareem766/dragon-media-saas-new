-- Explicitly document server-only access for RLS-protected tables.
-- These tables intentionally have no browser-facing policies. Service-role/server
-- operations bypass RLS; authenticated/anon clients remain denied.

create policy "server only access"
  on public.meta_delivery_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "server only access"
  on public.plan_entitlements
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "server only access"
  on public.system_secrets
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "server only access"
  on public.whatsapp_subscription_notifications
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "server only access"
  on public.whatsapp_test_messages
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Explicitly remove default PUBLIC execution on the sensitive RPCs while
-- preserving the existing authenticated calls required by the application.
revoke execute on function public.create_organization_for_user(text,text,text) from public;
revoke execute on function public.create_ryan_credit_purchase(integer,numeric,text,text,date,text,jsonb) from public;
revoke execute on function public.create_ryan_credit_purchase(uuid,text,text,date,text,jsonb) from public;
revoke execute on function public.current_organization_id() from public;
revoke execute on function public.generate_invite_code(text) from public;
revoke execute on function public.has_active_subscription() from public;
revoke execute on function public.redeem_invite_code(text,text) from public;
revoke execute on function public.submit_payment_request(uuid,numeric,text,text,date,text,text,text) from public;
revoke execute on function public.subscription_has_feature(uuid,text) from public;
revoke execute on function public.subscription_is_active(uuid) from public;
