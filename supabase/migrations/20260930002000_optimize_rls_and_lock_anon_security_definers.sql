-- Production hardening pass: optimize tenant RLS init plans and remove anonymous access to authenticated-only SECURITY DEFINER RPCs.
-- The SQL was applied directly to the production database on 2026-09-29; this file keeps the repository migration history aligned.

drop policy if exists users_select_own on public.users;
drop policy if exists users_select_same_org on public.users;
create policy users_select_self_or_same_org
on public.users for select to authenticated
using (
  (select auth.uid()) = id
  or organization_id = (select public.current_organization_id())
);

alter policy roles_admin_manage on public.roles
  using (exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.active = true
      and (u.is_platform_admin = true or u.role = any(array['super_admin'::text,'admin'::text]))
      and u.organization_id = roles.organization_id
  ))
  with check (exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.active = true
      and (u.is_platform_admin = true or u.role = any(array['super_admin'::text,'admin'::text]))
      and u.organization_id = roles.organization_id
  ));

alter policy payment_requests_tenant_select on public.payment_requests
  using (organization_id = (select public.current_organization_id())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.active = true));

alter policy invoices_tenant_select on public.invoices
  using (organization_id = (select public.current_organization_id())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.active = true));

alter policy payments_tenant_select on public.payments
  using (invoice_id in (select i.id from public.invoices i where i.organization_id = (select public.current_organization_id()))
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.active = true));

alter policy subscriptions_select_own_org on public.subscriptions
  using (organization_id = (select public.current_organization_id())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.active = true));

alter policy "ryan packages active read" on public.ryan_message_packages
  using (status = 'active'
    or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin = true and u.active = true));

alter policy "ryan packages admin delete" on public.ryan_message_packages
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin = true and u.active = true));

alter policy "ryan packages admin insert" on public.ryan_message_packages
  with check (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin = true and u.active = true));

alter policy "ryan packages admin update" on public.ryan_message_packages
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin = true and u.active = true))
  with check (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin = true and u.active = true));

revoke execute on function public.accept_invite_code(text) from anon;
revoke execute on function public.approve_payment_request(uuid,uuid) from anon;
revoke execute on function public.approve_ryan_credit_purchase(uuid,uuid) from anon;
revoke execute on function public.create_organization_for_user(text,text,text) from anon;
revoke execute on function public.create_organization_onboarding(text,text,text,text) from anon;
revoke execute on function public.create_ryan_credit_purchase(integer,numeric,text,text,date,text,jsonb) from anon;
revoke execute on function public.create_ryan_credit_purchase(uuid,text,text,date,text,jsonb) from anon;
revoke execute on function public.current_organization_id() from anon;
revoke execute on function public.generate_invite_code(text) from anon;
revoke execute on function public.has_active_subscription() from anon;
revoke execute on function public.redeem_invite_code(text,text) from anon;
revoke execute on function public.reject_payment_request(uuid,uuid,text) from anon;
revoke execute on function public.reject_ryan_credit_purchase(uuid,text,uuid) from anon;
revoke execute on function public.submit_payment_request(uuid,numeric,text,text,date,text,text,text) from anon;
revoke execute on function public.subscription_has_feature(uuid,text) from anon;
revoke execute on function public.subscription_is_active(uuid) from anon;
