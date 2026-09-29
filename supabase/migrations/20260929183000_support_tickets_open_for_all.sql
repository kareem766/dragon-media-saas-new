-- Support tickets are a core support channel for every authenticated company user.
-- Keep tenant isolation and suspension checks, but do not require feature permissions
-- for viewing, creating, or sending customer messages.

drop policy if exists support_tickets_select on public.support_tickets;
drop policy if exists support_tickets_insert on public.support_tickets;
drop policy if exists support_ticket_messages_tenant on public.support_ticket_messages;
drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;

create policy support_tickets_select
on public.support_tickets
for select
to authenticated
using (
  organization_id = current_organization_id()
);

create policy support_tickets_insert
on public.support_tickets
for insert
to authenticated
with check (
  organization_id = current_organization_id()
  and not org_is_suspended(organization_id)
);

create policy support_ticket_messages_tenant
on public.support_ticket_messages
for select
to authenticated
using (
  ticket_id in (
    select st.id
    from public.support_tickets st
    where st.organization_id = current_organization_id()
  )
);

create policy support_ticket_messages_insert
on public.support_ticket_messages
for insert
to authenticated
with check (
  ticket_id in (
    select st.id
    from public.support_tickets st
    where st.organization_id = current_organization_id()
      and not org_is_suspended(st.organization_id)
  )
  and sender_id = (select auth.uid())
  and sender_type = 'customer'
);
