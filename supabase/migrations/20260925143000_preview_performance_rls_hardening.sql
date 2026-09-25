-- Preview hardening: safe RLS performance improvements and missing FK coverage.
-- This migration is intentionally committed to the Preview branch only. It is
-- not applied to the live Supabase project by this change.

create index if not exists ai_content_posts_created_by_idx
  on public.ai_content_posts (created_by);

-- Evaluate auth/current-organization helpers once per statement instead of once
-- per row. The predicates remain semantically equivalent.
alter policy roles_admin_manage on public.roles
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.active = true
        and (u.is_platform_admin = true or u.role = any (array['super_admin'::text, 'admin'::text]))
        and u.organization_id = roles.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.active = true
        and (u.is_platform_admin = true or u.role = any (array['super_admin'::text, 'admin'::text]))
        and u.organization_id = roles.organization_id
    )
  );

alter policy payment_requests_tenant_select on public.payment_requests
  using (
    organization_id = (select public.current_organization_id())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.active = true
    )
  );

alter policy invoices_tenant_select on public.invoices
  using (
    organization_id = (select public.current_organization_id())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.active = true
    )
  );

alter policy payments_tenant_select on public.payments
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.organization_id = (select public.current_organization_id())
    )
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.active = true
    )
  );

alter policy subscriptions_select_own_org on public.subscriptions
  using (
    organization_id = (select public.current_organization_id())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.active = true
    )
  );

alter policy "ryan packages active read" on public.ryan_message_packages
  using (
    status = 'active'
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.is_platform_admin = true
        and u.active = true
    )
  );

alter policy "ryan packages admin insert" on public.ryan_message_packages
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.is_platform_admin = true
        and u.active = true
    )
  );

alter policy "ryan packages admin update" on public.ryan_message_packages
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.is_platform_admin = true
        and u.active = true
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.is_platform_admin = true
        and u.active = true
    )
  );

alter policy "ryan packages admin delete" on public.ryan_message_packages
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.is_platform_admin = true
        and u.active = true
    )
  );

-- users_select_own and users_select_same_org are both SELECT-permissive and
-- together mean exactly: own row OR same organization. Merge them into one
-- equivalent policy to avoid duplicate policy evaluation.
drop policy if exists users_select_own on public.users;
drop policy if exists users_select_same_org on public.users;
create policy users_select_own_or_same_org
  on public.users
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or organization_id = (select public.current_organization_id())
  );
