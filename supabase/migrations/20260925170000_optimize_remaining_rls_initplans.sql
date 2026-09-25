-- Preview-only performance hardening. Authorization semantics are unchanged.
drop policy if exists roles_admin_manage on public.roles;
create policy roles_admin_manage on public.roles for all to authenticated
using (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.active=true and (u.is_platform_admin=true or u.role=any(array['super_admin','admin'])) and u.organization_id=roles.organization_id))
with check (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.active=true and (u.is_platform_admin=true or u.role=any(array['super_admin','admin'])) and u.organization_id=roles.organization_id));

drop policy if exists payment_requests_tenant_select on public.payment_requests;
create policy payment_requests_tenant_select on public.payment_requests for select to authenticated
using (organization_id=(select public.current_organization_id()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.active=true));

drop policy if exists invoices_tenant_select on public.invoices;
create policy invoices_tenant_select on public.invoices for select to authenticated
using (organization_id=(select public.current_organization_id()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.active=true));

drop policy if exists payments_tenant_select on public.payments;
create policy payments_tenant_select on public.payments for select to authenticated
using (invoice_id in (select i.id from public.invoices i where i.organization_id=(select public.current_organization_id())) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.active=true));

drop policy if exists subscriptions_select_own_org on public.subscriptions;
create policy subscriptions_select_own_org on public.subscriptions for select to authenticated
using (organization_id=(select public.current_organization_id()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.active=true));

drop policy if exists "ryan packages active read" on public.ryan_message_packages;
create policy "ryan packages active read" on public.ryan_message_packages for select to authenticated
using (status='active' or exists (select 1 from public.users u where u.id=(select auth.uid()) and u.is_platform_admin=true and u.active=true));

drop policy if exists "ryan packages admin delete" on public.ryan_message_packages;
create policy "ryan packages admin delete" on public.ryan_message_packages for delete to authenticated
using (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.is_platform_admin=true and u.active=true));

drop policy if exists "ryan packages admin insert" on public.ryan_message_packages;
create policy "ryan packages admin insert" on public.ryan_message_packages for insert to authenticated
with check (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.is_platform_admin=true and u.active=true));

drop policy if exists "ryan packages admin update" on public.ryan_message_packages;
create policy "ryan packages admin update" on public.ryan_message_packages for update to authenticated
using (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.is_platform_admin=true and u.active=true))
with check (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.is_platform_admin=true and u.active=true));

create index if not exists ai_content_posts_created_by_idx on public.ai_content_posts(created_by);
